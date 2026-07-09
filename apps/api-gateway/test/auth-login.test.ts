import { hash as argonHash } from "@node-rs/argon2";
import { describe, expect, it } from "vitest";

import { buildTestApp, makeFakeDb } from "./helpers";

const EXISTING_USER_ID = "cccccccc-dddd-4eee-8fff-000011112222";
const EXISTING_PROFILE_ID = "22223333-4444-4555-8666-777788889999";
const PASSWORD = "correct-horse-battery";

async function dbWithUser(overrides: Record<string, unknown> = {}) {
	const passwordHash = await argonHash(PASSWORD);
	return makeFakeDb([
		{
			match: "FROM users u",
			rows: [
				{
					id: EXISTING_USER_ID,
					email: "learner@example.com",
					password_hash: passwordHash,
					display_name: "Existing Learner",
					role: "learner",
					subscription_tier: "pro",
					is_active: true,
					learner_profile_id: EXISTING_PROFILE_ID,
					target_language: "en",
					target_exam: "ielts_academic",
					...overrides,
				},
			],
		},
	]);
}

describe("POST /api/v1/auth/login", () => {
	it("returns 200 with an access token and sets the refresh cookie on correct credentials", async () => {
		const db = await dbWithUser();
		const { app } = await buildTestApp({ db });

		const res = await app.inject({
			method: "POST",
			url: "/api/v1/auth/login",
			payload: { email: "learner@example.com", password: PASSWORD },
		});

		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.user.id).toBe(EXISTING_USER_ID);
		expect(body.user.subscription_tier).toBe("pro");
		expect(typeof body.access_token).toBe("string");
		expect(res.cookies.some((c) => c.name === "lm_refresh")).toBe(true);
	});

	it("records last_login_at on a successful login", async () => {
		const db = await dbWithUser();
		const { app } = await buildTestApp({ db });

		await app.inject({
			method: "POST",
			url: "/api/v1/auth/login",
			payload: { email: "learner@example.com", password: PASSWORD },
		});

		const update = db.calls.find((c) => c.text.includes("SET last_login_at"));
		expect(update?.params).toEqual([EXISTING_USER_ID]);
	});

	it("returns 401 INVALID_CREDENTIALS for an unknown email", async () => {
		const db = makeFakeDb([{ match: "FROM users u", rows: [] }]);
		const { app } = await buildTestApp({ db });

		const res = await app.inject({
			method: "POST",
			url: "/api/v1/auth/login",
			payload: { email: "nobody@example.com", password: PASSWORD },
		});

		expect(res.statusCode).toBe(401);
		expect(res.json()).toEqual({
			error: { code: "INVALID_CREDENTIALS", message: "email or password is incorrect" },
		});
	});

	it("returns the byte-identical 401 body for a wrong password (no account-enumeration signal)", async () => {
		const db = await dbWithUser();
		const { app } = await buildTestApp({ db });

		const res = await app.inject({
			method: "POST",
			url: "/api/v1/auth/login",
			payload: { email: "learner@example.com", password: "totally-wrong-password" },
		});

		expect(res.statusCode).toBe(401);
		expect(res.json()).toEqual({
			error: { code: "INVALID_CREDENTIALS", message: "email or password is incorrect" },
		});
	});

	it("returns the same 401 for a deactivated account with the correct password", async () => {
		const db = await dbWithUser({ is_active: false });
		const { app } = await buildTestApp({ db });

		const res = await app.inject({
			method: "POST",
			url: "/api/v1/auth/login",
			payload: { email: "learner@example.com", password: PASSWORD },
		});

		expect(res.statusCode).toBe(401);
		expect(res.json()).toEqual({
			error: { code: "INVALID_CREDENTIALS", message: "email or password is incorrect" },
		});
	});

	it("rejects a missing password with a 400 envelope", async () => {
		const { app } = await buildTestApp({ db: await dbWithUser() });

		const res = await app.inject({
			method: "POST",
			url: "/api/v1/auth/login",
			payload: { email: "learner@example.com" },
		});

		expect(res.statusCode).toBe(400);
		expect(res.json().error.code).toBe("VALIDATION_ERROR");
	});
});
