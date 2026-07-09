import { SignJWT, importPKCS8 } from "jose";
import { describe, expect, it } from "vitest";

import { JWT_ISSUER, REFRESH_COOKIE_NAME, REFRESH_KEY_PREFIX, REFRESH_TOKEN_TTL_SECONDS } from "../src/config/constants";
import {
	LEARNER_PROFILE_ID,
	USER_ID,
	buildTestApp,
	makeFakeDb,
	makeTestJwtMaterial,
	signTestAccessToken,
} from "./helpers";

function dbWithUser(overrides: Record<string, unknown> = {}) {
	return makeFakeDb([
		{
			match: "FROM users u",
			rows: [
				{
					id: USER_ID,
					email: "learner@example.com",
					display_name: "Existing Learner",
					role: "learner",
					subscription_tier: "free",
					is_active: true,
					learner_profile_id: LEARNER_PROFILE_ID,
					target_language: "en",
					target_exam: null,
					...overrides,
				},
			],
		},
	]);
}

async function seedLiveRefreshToken(material: Awaited<ReturnType<typeof makeTestJwtMaterial>>, redis: {
	setex(key: string, ttl: number, value: string): Promise<void>;
}) {
	const { token, jti } = await material.jwt.signRefreshToken(USER_ID);
	await redis.setex(`${REFRESH_KEY_PREFIX}${jti}`, REFRESH_TOKEN_TTL_SECONDS, USER_ID);
	return token;
}

async function signExpiredRefreshToken(privateKeyPem: string): Promise<string> {
	const key = await importPKCS8(privateKeyPem, "RS256");
	const now = Math.floor(Date.now() / 1000);
	return new SignJWT({ token_use: "refresh" })
		.setProtectedHeader({ alg: "RS256" })
		.setIssuer(JWT_ISSUER)
		.setSubject(USER_ID)
		.setJti("expired-jti")
		.setIssuedAt(now - 1000)
		.setExpirationTime(now - 500)
		.sign(key);
}

describe("POST /api/v1/auth/refresh", () => {
	it("rotates the refresh token: issues a new pair and consumes the old jti", async () => {
		const material = await makeTestJwtMaterial();
		const { app, redis } = await buildTestApp({ db: dbWithUser(), jwt: material.jwt });
		const oldToken = await seedLiveRefreshToken(material, redis);
		expect(redis.store.size).toBe(1);

		const res = await app.inject({
			method: "POST",
			url: "/api/v1/auth/refresh",
			cookies: { [REFRESH_COOKIE_NAME]: oldToken },
		});

		expect(res.statusCode).toBe(200);
		expect(typeof res.json().access_token).toBe("string");
		const newCookie = res.cookies.find((c) => c.name === REFRESH_COOKIE_NAME);
		expect(newCookie?.value).toBeTruthy();
		expect(newCookie?.value).not.toBe(oldToken);

		// The old jti is gone (consumed by GETDEL); a new one has taken its place.
		expect(redis.store.size).toBe(1);
	});

	it("rejects replaying an already-rotated refresh cookie", async () => {
		const material = await makeTestJwtMaterial();
		const { app, redis } = await buildTestApp({ db: dbWithUser(), jwt: material.jwt });
		const token = await seedLiveRefreshToken(material, redis);

		const first = await app.inject({
			method: "POST",
			url: "/api/v1/auth/refresh",
			cookies: { [REFRESH_COOKIE_NAME]: token },
		});
		expect(first.statusCode).toBe(200);

		// Replaying the exact same (now-consumed) cookie must fail — this is
		// the whole point of rotation: a stolen refresh cookie is only good
		// for one redemption before the legitimate client's next refresh
		// invalidates it, making reuse detectable.
		const replay = await app.inject({
			method: "POST",
			url: "/api/v1/auth/refresh",
			cookies: { [REFRESH_COOKIE_NAME]: token },
		});

		expect(replay.statusCode).toBe(401);
		expect(replay.json().error.code).toBe("INVALID_REFRESH_TOKEN");
	});

	it("rejects a request with no refresh cookie", async () => {
		const { app } = await buildTestApp({ db: dbWithUser() });

		const res = await app.inject({ method: "POST", url: "/api/v1/auth/refresh" });

		expect(res.statusCode).toBe(401);
		expect(res.json().error.code).toBe("INVALID_REFRESH_TOKEN");
	});

	it("rejects an access token presented as the refresh cookie", async () => {
		const material = await makeTestJwtMaterial();
		const { app } = await buildTestApp({ db: dbWithUser(), jwt: material.jwt });
		const accessToken = await signTestAccessToken(material.jwt, { sub: USER_ID, lpid: LEARNER_PROFILE_ID });

		const res = await app.inject({
			method: "POST",
			url: "/api/v1/auth/refresh",
			cookies: { [REFRESH_COOKIE_NAME]: accessToken },
		});

		expect(res.statusCode).toBe(401);
		expect(res.json().error.code).toBe("INVALID_REFRESH_TOKEN");
	});

	it("returns TOKEN_EXPIRED for an expired refresh token", async () => {
		const material = await makeTestJwtMaterial();
		const { app } = await buildTestApp({ db: dbWithUser(), jwt: material.jwt });
		const expired = await signExpiredRefreshToken(material.privateKeyPem);

		const res = await app.inject({
			method: "POST",
			url: "/api/v1/auth/refresh",
			cookies: { [REFRESH_COOKIE_NAME]: expired },
		});

		expect(res.statusCode).toBe(401);
		expect(res.json().error.code).toBe("TOKEN_EXPIRED");
	});

	it("rejects refresh for a deactivated account even with a live jti", async () => {
		const material = await makeTestJwtMaterial();
		const { app, redis } = await buildTestApp({ db: dbWithUser({ is_active: false }), jwt: material.jwt });
		const token = await seedLiveRefreshToken(material, redis);

		const res = await app.inject({
			method: "POST",
			url: "/api/v1/auth/refresh",
			cookies: { [REFRESH_COOKIE_NAME]: token },
		});

		expect(res.statusCode).toBe(401);
		expect(res.json().error.code).toBe("INVALID_REFRESH_TOKEN");
	});
});

describe("POST /api/v1/auth/logout", () => {
	it("revokes the refresh token, clears the cookie, and returns 204", async () => {
		const material = await makeTestJwtMaterial();
		const { app, redis } = await buildTestApp({ db: dbWithUser(), jwt: material.jwt });
		const token = await seedLiveRefreshToken(material, redis);
		expect(redis.store.size).toBe(1);

		const res = await app.inject({
			method: "POST",
			url: "/api/v1/auth/logout",
			cookies: { [REFRESH_COOKIE_NAME]: token },
		});

		expect(res.statusCode).toBe(204);
		expect(redis.store.size).toBe(0);
		const cleared = res.cookies.find((c) => c.name === REFRESH_COOKIE_NAME);
		expect(cleared?.value).toBe("");
		expect(cleared?.maxAge).toBe(0);
	});

	it("is idempotent — logging out with no cookie still returns 204", async () => {
		const { app } = await buildTestApp({ db: dbWithUser() });

		const res = await app.inject({ method: "POST", url: "/api/v1/auth/logout" });

		expect(res.statusCode).toBe(204);
	});
});
