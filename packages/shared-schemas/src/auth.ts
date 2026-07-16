// Request bodies for the auth endpoints, shared so the frontend and the gateway validate identically.
import { z } from "zod";

// Lowercased because `users.email` compares case-sensitively — one address would otherwise become two accounts.
const emailSchema = z.string().trim().toLowerCase().email();

export const registerBodySchema = z.object({
	email: emailSchema,
	// A floor to keep obvious junk out of argon2, not a strength policy.
	password: z.string().min(8),
	display_name: z.string().min(1).max(100),
	// Only en/fr have calibrated rubrics in Phase 1 (PRD §7.1).
	target_language: z.enum(["en", "fr"]),
	target_exam: z.string().min(1).optional(),
});
export type RegisterBody = z.infer<typeof registerBodySchema>;

export const loginBodySchema = z.object({
	email: emailSchema,
	password: z.string().min(1),
});
export type LoginBody = z.infer<typeof loginBodySchema>;
