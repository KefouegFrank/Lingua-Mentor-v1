// JWT RS256 sign/verify using keys from env (JWT_PRIVATE_KEY_PATH / JWT_PUBLIC_KEY_PATH).
//
// One keypair signs two different kinds of token — a short-lived access
// token and a long-lived refresh token — so every payload carries a
// `token_use` claim and every verify call checks it. Without that check, a
// stolen access token would double as a valid refresh token: same
// signature, same issuer, nothing to tell them apart.
import { randomUUID } from "node:crypto";
import { SignJWT, errors as joseErrors, importPKCS8, importSPKI, jwtVerify } from "jose";

import { ACCESS_TOKEN_TTL, JWT_ISSUER, REFRESH_TOKEN_TTL_SECONDS } from "../../config/constants";

export class TokenExpiredError extends Error {
	constructor() {
		super("token has expired");
		this.name = "TokenExpiredError";
	}
}

export class InvalidTokenError extends Error {
	constructor(reason: string) {
		super(reason);
		this.name = "InvalidTokenError";
	}
}

export interface AccessTokenClaims {
	sub: string; // user id
	role: string;
	tier: string;
	lpid: string; // learner_profile_id — what the rest of the API actually keys off
}

export interface AccessTokenPayload extends AccessTokenClaims {
	tokenUse: "access";
}

export interface RefreshTokenPayload {
	sub: string;
	jti: string;
	tokenUse: "refresh";
}

export class JwtStrategy {
	// Importing a PEM is async but the key itself never changes for the life
	// of the process, so we do it once and cache the promise — every sign/
	// verify call after the first just awaits the same resolved value.
	private privateKeyPromise: ReturnType<typeof importPKCS8> | null = null;
	private publicKeyPromise: ReturnType<typeof importSPKI> | null = null;

	constructor(
		private readonly privateKeyPem: string,
		private readonly publicKeyPem: string,
	) {}

	private getPrivateKey() {
		this.privateKeyPromise ??= importPKCS8(this.privateKeyPem, "RS256");
		return this.privateKeyPromise;
	}

	private getPublicKey() {
		this.publicKeyPromise ??= importSPKI(this.publicKeyPem, "RS256");
		return this.publicKeyPromise;
	}

	async signAccessToken(claims: AccessTokenClaims): Promise<string> {
		const key = await this.getPrivateKey();
		return new SignJWT({ role: claims.role, tier: claims.tier, lpid: claims.lpid, token_use: "access" })
			.setProtectedHeader({ alg: "RS256" })
			.setIssuer(JWT_ISSUER)
			.setSubject(claims.sub)
			.setIssuedAt()
			.setExpirationTime(ACCESS_TOKEN_TTL)
			.sign(key);
	}

	/** Returns the jti alongside the token so the caller can register it as
	 * "live" in Redis — the token itself is opaque once signed. */
	async signRefreshToken(userId: string): Promise<{ token: string; jti: string }> {
		const key = await this.getPrivateKey();
		const jti = randomUUID();
		const token = await new SignJWT({ token_use: "refresh" })
			.setProtectedHeader({ alg: "RS256" })
			.setIssuer(JWT_ISSUER)
			.setSubject(userId)
			.setJti(jti)
			.setIssuedAt()
			.setExpirationTime(`${REFRESH_TOKEN_TTL_SECONDS}s`)
			.sign(key);
		return { token, jti };
	}

	async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
		const payload = await this.verify(token);
		if (payload.token_use !== "access") {
			throw new InvalidTokenError("token is not an access token");
		}
		return {
			sub: payload.sub as string,
			role: payload.role as string,
			tier: payload.tier as string,
			lpid: payload.lpid as string,
			tokenUse: "access",
		};
	}

	async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
		const payload = await this.verify(token);
		if (payload.token_use !== "refresh" || typeof payload.jti !== "string") {
			throw new InvalidTokenError("token is not a refresh token");
		}
		return { sub: payload.sub as string, jti: payload.jti, tokenUse: "refresh" };
	}

	private async verify(token: string) {
		const key = await this.getPublicKey();
		try {
			const { payload } = await jwtVerify(token, key, {
				issuer: JWT_ISSUER,
				algorithms: ["RS256"],
			});
			return payload;
		} catch (err) {
			if (err instanceof joseErrors.JWTExpired) {
				throw new TokenExpiredError();
			}
			throw new InvalidTokenError(err instanceof Error ? err.message : "invalid token");
		}
	}
}
