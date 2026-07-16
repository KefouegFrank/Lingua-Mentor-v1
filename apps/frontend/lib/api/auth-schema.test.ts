import { loginBodySchema, registerBodySchema } from "@lingumentor/shared-schemas";
import { describe, expect, it } from "vitest";

// The exact schemas the signup/login forms run via zodResolver, so these
// boundary cases are the forms' client-side error states.
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

	it("trims and lowercases the email", () => {
		const result = registerBodySchema.safeParse({
			email: " Ada.Lovelace@Example.COM ",
			password: "correct-horse",
			display_name: "Ada Lovelace",
			target_language: "en",
		});
		expect(result.success && result.data.email).toBe("ada.lovelace@example.com");
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
		// The register page requires target_exam locally; the shared contract
		// stays permissive since no other caller needs it yet.
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

	it("normalizes the email the same way register does", () => {
		const result = loginBodySchema.safeParse({
			email: " Learner@Example.COM ",
			password: "whatever-they-picked",
		});
		expect(result.success && result.data.email).toBe("learner@example.com");
	});
});
