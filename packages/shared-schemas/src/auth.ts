// Request bodies for the auth endpoints. Shared between the frontend (which
// validates the signup/login forms before submitting) and the gateway
// (which validates again at the boundary — never trust the client alone).
import { z } from "zod";

export const registerBodySchema = z.object({
	email: z.string().email(),
	// 8 chars is the floor, not a strength policy — we're not in the
	// business of judging password quality here, just rejecting the
	// obviously-too-short ones before they hit argon2.
	password: z.string().min(8),
	display_name: z.string().min(1).max(100),
	// Phase 1 language scope (Master PRD §7.1) — only English and French
	// have calibrated rubrics, so the signup form can't offer anything else.
	target_language: z.enum(["en", "fr"]),
	target_exam: z.string().min(1).optional(),
});
export type RegisterBody = z.infer<typeof registerBodySchema>;

export const loginBodySchema = z.object({
	email: z.string().email(),
	password: z.string().min(1),
});
export type LoginBody = z.infer<typeof loginBodySchema>;
