// Request validation for the placement module. Kept local (not in
// shared-schemas) until the frontend needs the same shape.
import { z } from "zod";

export const placementSubmitSchema = z.object({
	prompt_text: z.string().min(1),
	essay_text: z.string().min(1),
});

export type PlacementSubmitBody = z.infer<typeof placementSubmitSchema>;
