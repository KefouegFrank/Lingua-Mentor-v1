// The submit body is shared with the frontend; route params stay local since
// only this gateway parses them.
import { z } from "zod";

export { submitBodySchema, type SubmitBody } from "@lingumentor/shared-schemas";

export const sessionIdParamSchema = z.object({
	session_id: z.string().uuid(),
});

export const appealIdParamSchema = z.object({
	appeal_id: z.string().uuid(),
});

// Optional: an appeal needs no stated reason (PRD §21.4), but one is stored
// for the calibration review loop when given.
export const appealBodySchema = z
	.object({
		appeal_reason: z.string().trim().min(1).max(2000).optional(),
	})
	.optional();
