// Request validation for the writing module. The submit body is shared with
// the frontend via @lingumentor/shared-schemas; route params stay local
// since only this gateway ever parses them.
import { z } from "zod";

export { submitBodySchema, type SubmitBody } from "@lingumentor/shared-schemas";

export const sessionIdParamSchema = z.object({
	session_id: z.string().uuid(),
});

export const appealIdParamSchema = z.object({
	appeal_id: z.string().uuid(),
});

// Body is optional entirely — an appeal doesn't require a stated reason
// (PRD §21.4), but when given it's stored for the calibration review loop.
export const appealBodySchema = z
	.object({
		appeal_reason: z.string().trim().min(1).max(2000).optional(),
	})
	.optional();
