// Request validation for the writing module. The submit body is shared with
// the frontend via @lingumentor/shared-schemas; route params stay local
// since only this gateway ever parses them.
import { z } from "zod";

export { submitBodySchema, type SubmitBody } from "@lingumentor/shared-schemas";

export const sessionIdParamSchema = z.object({
	session_id: z.string().uuid(),
});
