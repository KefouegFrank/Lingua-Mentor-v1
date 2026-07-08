// Request validation for the writing module (zod). Exam ids are validated
// against the exam-config registry by ai-service — the gateway only checks
// shape, so adding an exam YAML never requires a gateway deploy.
import { z } from "zod";

export const submitBodySchema = z.object({
	exam_type: z.string().min(1),
	prompt_text: z.string().min(1),
	essay_text: z.string().min(1),
});
export type SubmitBody = z.infer<typeof submitBodySchema>;

export const sessionIdParamSchema = z.object({
	session_id: z.string().uuid(),
});

// TODO(slice-5): replace with the learner_profile_id claim from the verified
// JWT. This header is a dev-interim identity until the auth service lands.
export const learnerProfileIdHeaderSchema = z.string().uuid();
