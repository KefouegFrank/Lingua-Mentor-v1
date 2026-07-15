import { loginBodySchema, registerBodySchema } from "@lingumentor/shared-schemas";
import { describe, expect, it } from "vitest";

// These schemas are what login/register page.tsx wire into react-hook-form
// via zodResolver — this is the exact validation the signup/login forms run
// client-side before ever hitting the gateway, so getting the boundary
// cases right here is getting the forms' error states right.
describe("registerBodySchema", () => {
	it("accepts a well-formed registration payload", () => {
		const result = registerBodySchema.safeParse({
			email: "learner@example.com",
			password: "correct-horse",
			display_name: "Ada Lovelace",
			target_language: "en",
			target_exam: "ielts_academic",
		});
		expect(result.success).toBe(true);
	});

	it("rejects a password under the 8-character floor", () => {
		const result = registerBodySchema.safeParse({
			email: "learner@example.com",
			password: "short1",
			display_name: "Ada Lovelace",
			target_language: "en",
		});
		expect(result.success).toBe(false);
	});

	it("rejects a malformed email", () => {
		const result = registerBodySchema.safeParse({
			email: "not-an-email",
			password: "correct-horse",
			display_name: "Ada Lovelace",
			target_language: "en",
		});
		expect(result.success).toBe(false);
	});

	it("rejects a target_language outside the Phase 1 scope (en/fr)", () => {
		const result = registerBodySchema.safeParse({
			email: "learner@example.com",
			password: "correct-horse",
			display_name: "Ada Lovelace",
			target_language: "de",
		});
		expect(result.success).toBe(false);
	});

	it("treats target_exam as optional at the shared-schema level", () => {
		// The register page tightens this locally (registerFormSchema extends
		// this with a required target_exam) — the shared contract itself
		// stays permissive because the gateway has no other caller that
		// requires it yet.
		const result = registerBodySchema.safeParse({
			email: "learner@example.com",
			password: "correct-horse",
			display_name: "Ada Lovelace",
			target_language: "fr",
		});
		expect(result.success).toBe(true);
	});
});

describe("loginBodySchema", () => {
	it("accepts a well-formed login payload", () => {
		const result = loginBodySchema.safeParse({
			email: "learner@example.com",
			password: "whatever-they-picked",
		});
		expect(result.success).toBe(true);
	});

	it("rejects an empty password", () => {
		const result = loginBodySchema.safeParse({
			email: "learner@example.com",
			password: "",
		});
		expect(result.success).toBe(false);
	});
});
