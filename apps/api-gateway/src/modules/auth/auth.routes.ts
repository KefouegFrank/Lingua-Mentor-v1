// POST /auth/register, /auth/login, /auth/refresh, /auth/logout
// Registered under /api/v1/auth in app.ts.
import type { FastifyInstance, FastifyReply } from "fastify";

import {
	REFRESH_COOKIE_NAME,
	REFRESH_COOKIE_PATH,
	REFRESH_TOKEN_TTL_SECONDS,
} from "../../config/constants";
import { AppError } from "../../plugins/error-envelope";
import { loginBodySchema, registerBodySchema } from "./auth.schema";
import {
	type AuthDeps,
	type PublicUser,
	loginUser,
	logoutUser,
	refreshSession,
	registerUser,
} from "./auth.service";

function setRefreshCookie(reply: FastifyReply, token: string): void {
	reply.setCookie(REFRESH_COOKIE_NAME, token, {
		httpOnly: true,
		// Not unconditional: browsers silently drop a Secure cookie over plain
		// HTTP, which would break session restore on http://localhost in dev.
		secure: process.env.NODE_ENV === "production",
		sameSite: "strict",
		path: REFRESH_COOKIE_PATH,
		maxAge: REFRESH_TOKEN_TTL_SECONDS,
	});
}

// The one place camelCase PublicUser becomes the API's snake_case JSON shape.
function toResponseUser(user: PublicUser) {
	return {
		id: user.id,
		email: user.email,
		display_name: user.displayName,
		role: user.role,
		subscription_tier: user.subscriptionTier,
		learner_profile_id: user.learnerProfileId,
		target_language: user.targetLanguage,
		target_exam: user.targetExam,
	};
}

export default async function authRoutes(app: FastifyInstance): Promise<void> {
	const deps: AuthDeps = { db: app.db, redis: app.redis, jwt: app.jwt };

	// TODO(slice-6): rate-limit register/login (per-IP and per-email) on the
	// Redis token bucket built for AI-endpoint quotas — same mitigation fits.
	app.post("/register", async (request, reply) => {
		const body = registerBodySchema.parse(request.body);
		const { user, tokens } = await registerUser(deps, {
			email: body.email,
			password: body.password,
			displayName: body.display_name,
			targetLanguage: body.target_language,
			targetExam: body.target_exam,
		});
		setRefreshCookie(reply, tokens.refreshToken);
		return reply.status(201).send({ access_token: tokens.accessToken, user: toResponseUser(user) });
	});

	app.post("/login", async (request, reply) => {
		const body = loginBodySchema.parse(request.body);
		const { user, tokens } = await loginUser(deps, { email: body.email, password: body.password });
		setRefreshCookie(reply, tokens.refreshToken);
		return { access_token: tokens.accessToken, user: toResponseUser(user) };
	});

	app.post("/refresh", async (request, reply) => {
		const refreshToken = request.cookies[REFRESH_COOKIE_NAME];
		if (!refreshToken) {
			throw new AppError(401, "INVALID_REFRESH_TOKEN", "no refresh token cookie present");
		}
		const { user, tokens } = await refreshSession(deps, refreshToken);
		setRefreshCookie(reply, tokens.refreshToken);
		return { access_token: tokens.accessToken, user: toResponseUser(user) };
	});

	app.post("/logout", async (request, reply) => {
		const refreshToken = request.cookies[REFRESH_COOKIE_NAME];
		await logoutUser(deps, refreshToken);
		reply.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
		return reply.status(204).send();
	});

	// TODO(phase-2): POST /auth/password/reset + PATCH /auth/password, once an
	// email provider is chosen — ADR 0001 doesn't cover transactional email.
}
