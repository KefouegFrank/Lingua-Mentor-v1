// Writing evaluation submission body — shared between the frontend's essay
// submission form and the gateway's /api/v1/writing/submit endpoint.
import { z } from "zod";

export const submitBodySchema = z.object({
	exam_type: z.string().min(1),
	prompt_text: z.string().min(1),
	essay_text: z.string().min(1),
});
export type SubmitBody = z.infer<typeof submitBodySchema>;
