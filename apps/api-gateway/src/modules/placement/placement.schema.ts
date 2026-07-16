// Request validation for the placement module. Kept local (not in
// shared-schemas) until the frontend needs the same shape.
import { z } from "zod";

export const placementSubmitSchema = z.object({
	task_id: z.string().min(1),
	// Capped so one submission can't burn an unbounded number of grader tokens;
	// far above any real Task 2 essay.
	essay_text: z.string().trim().min(1).max(20000),
});

export type PlacementSubmitBody = z.infer<typeof placementSubmitSchema>;
