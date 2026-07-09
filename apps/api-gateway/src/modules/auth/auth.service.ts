// Business logic: password hashing, token issuance.
import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";

import { REFRESH_KEY_PREFIX, REFRESH_TOKEN_TTL_SECONDS } from "../../config/constants";
import type { DbClient } from "../../db/client";
import { AppError } from "../../plugins/error-envelope";
import type { RedisKv } from "../../redis/client";
import { JwtStrategy, TokenExpiredError } from "./jwt.strategy";

export interface AuthDeps {
	db: DbClient;
	redis: RedisKv;
	jwt: JwtStrategy;
}

export interface AuthTokens {
	accessToken: string;
	refreshToken: string;
}

export interface PublicUser {
	id: string;
	email: string;
	displayName: string;
	role: string;
	subscriptionTier: string;
	learnerProfileId: string;
	targetLanguage: string;
	targetExam: string | null;
}

export interface RegisterInput {
	email: string;
	password: string;
	displayName: string;
	targetLanguage: string;
	targetExam?: string;
}

export interface LoginInput {
	email: string;
	password: string;
}

// A real argon2id hash of a password nobody will ever type, computed once
// and hardcoded. Verifying against it when an email isn't found costs the
// same CPU time as verifying a real password — without it, an attacker
// could tell "wrong password" from "no such account" just by timing the
// response, which turns login into an email-enumeration oracle.
const DUMMY_PASSWORD_HASH =
	"$argon2id$v=19$m=19456,t=2,p=1$hTvgdDP6JuRBV8JSMvvECw$kTICjOBG5T7+OsT44i1dONGBaD3VJun1RMXVoTk5Vto";

function isUniqueViolation(err: unknown): boolean {
	// Postgres error code for a unique-constraint violation — the pg driver
	// attaches it as a plain `code` string on the thrown error.
	return typeof err === "object" && err !== null && "code" in err && err.code === "23505";
}

function toPublicUser(row: Record<string, unknown>): PublicUser {
	return {
		id: String(row.id),
		email: String(row.email),
		displayName: String(row.display_name),
		role: String(row.role),
		subscriptionTier: String(row.subscription_tier),
		learnerProfileId: String(row.learner_profile_id),
		targetLanguage: String(row.target_language),
		targetExam: row.target_exam == null ? null : String(row.target_exam),
	};
}

async function issueTokens(deps: AuthDeps, user: PublicUser): Promise<AuthTokens> {
	const accessToken = await deps.jwt.signAccessToken({
		sub: user.id,
		role: user.role,
		tier: user.subscriptionTier,
		lpid: user.learnerProfileId,
	});
	const { token: refreshToken, jti } = await deps.jwt.signRefreshToken(user.id);
	// The refresh token is only as good as its Redis entry — this is what
	// makes it revocable at all (a JWT alone can't be "un-issued").
	await deps.redis.setex(`${REFRESH_KEY_PREFIX}${jti}`, REFRESH_TOKEN_TTL_SECONDS, user.id);
	return { accessToken, refreshToken };
}

export async function registerUser(
	deps: AuthDeps,
	input: RegisterInput,
): Promise<{ user: PublicUser; tokens: AuthTokens }> {
	const passwordHash = await argonHash(input.password);

	let row: Record<string, unknown>;
	try {
		row = await deps.db.transaction(async (tx) => {
			// A user without a learner profile is a half-created account —
			// both rows land together or neither does.
			const userResult = await tx.query(
				`INSERT INTO users (email, password_hash, display_name)
				 VALUES ($1, $2, $3)
				 RETURNING id, email, display_name, role, subscription_tier`,
				[input.email, passwordHash, input.displayName],
			);
			const userRow = userResult.rows[0];

			const profileResult = await tx.query(
				`INSERT INTO learner_profiles (user_id, target_language, target_exam)
				 VALUES ($1, $2, $3)
				 RETURNING id, target_language, target_exam`,
				[userRow.id, input.targetLanguage, input.targetExam ?? null],
			);
			const profileRow = profileResult.rows[0];

			return {
				...userRow,
				learner_profile_id: profileRow.id,
				target_language: profileRow.target_language,
				target_exam: profileRow.target_exam,
			};
		});
	} catch (err) {
		if (isUniqueViolation(err)) {
			throw new AppError(409, "EMAIL_TAKEN", "an account with this email already exists", "email");
		}
		throw err;
	}

	const user = toPublicUser(row);
	const tokens = await issueTokens(deps, user);
	return { user, tokens };
}

export async function loginUser(
	deps: AuthDeps,
	input: LoginInput,
): Promise<{ user: PublicUser; tokens: AuthTokens }> {
	const { rows } = await deps.db.query(
		`SELECT u.id, u.email, u.password_hash, u.display_name, u.role, u.subscription_tier, u.is_active,
				lp.id AS learner_profile_id, lp.target_language, lp.target_exam
		 FROM users u
		 JOIN learner_profiles lp ON lp.user_id = u.id
		 WHERE u.email = $1`,
		[input.email],
	);
	const row = rows[0];

	const passwordOk = await argonVerify(
		row ? String(row.password_hash) : DUMMY_PASSWORD_HASH,
		input.password,
	);

	// Unknown email, wrong password, and a deactivated account all produce
	// the exact same error — telling them apart would hand an attacker a
	// free account-enumeration tool.
	if (!row || !passwordOk || !row.is_active) {
		throw new AppError(401, "INVALID_CREDENTIALS", "email or password is incorrect");
	}

	await deps.db.query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [row.id]);

	const user = toPublicUser(row);
	const tokens = await issueTokens(deps, user);
	return { user, tokens };
}

export async function refreshSession(
	deps: AuthDeps,
	refreshToken: string,
): Promise<{ user: PublicUser; tokens: AuthTokens }> {
	let claims;
	try {
		claims = await deps.jwt.verifyRefreshToken(refreshToken);
	} catch (err) {
		if (err instanceof TokenExpiredError) {
			throw new AppError(401, "TOKEN_EXPIRED", "refresh token has expired");
		}
		throw new AppError(401, "INVALID_REFRESH_TOKEN", "refresh token is invalid");
	}

	// GETDEL is the rotation primitive: redeeming a refresh token consumes
	// it atomically in one round trip, so the same cookie value can never
	// succeed twice. Replaying an already-rotated token — a stolen cookie,
	// a browser back-button race after a legitimate refresh — lands here
	// with nothing left to redeem, rather than quietly minting a second
	// valid session alongside the real one.
	const storedUserId = await deps.redis.getdel(`${REFRESH_KEY_PREFIX}${claims.jti}`);
	if (!storedUserId || storedUserId !== claims.sub) {
		throw new AppError(401, "INVALID_REFRESH_TOKEN", "refresh token has already been used or revoked");
	}

	const { rows } = await deps.db.query(
		`SELECT u.id, u.email, u.display_name, u.role, u.subscription_tier, u.is_active,
				lp.id AS learner_profile_id, lp.target_language, lp.target_exam
		 FROM users u
		 JOIN learner_profiles lp ON lp.user_id = u.id
		 WHERE u.id = $1`,
		[claims.sub],
	);
	const row = rows[0];
	if (!row || !row.is_active) {
		throw new AppError(401, "INVALID_REFRESH_TOKEN", "account is no longer active");
	}

	const user = toPublicUser(row);
	const tokens = await issueTokens(deps, user);
	return { user, tokens };
}

export async function logoutUser(
	deps: Pick<AuthDeps, "redis" | "jwt">,
	refreshToken: string | undefined,
): Promise<void> {
	if (!refreshToken) return;
	try {
		const claims = await deps.jwt.verifyRefreshToken(refreshToken);
		await deps.redis.del(`${REFRESH_KEY_PREFIX}${claims.jti}`);
	} catch {
		// Logging out is idempotent from the client's point of view — an
		// already-expired, already-used, or garbage token still results in
		// "you are logged out", not an error the frontend has to handle.
	}
}
