// Voice session message schemas.
import { z } from "zod";

// Values mirror the teaching_persona PG enum; ai-service owns the definitions
// and the tier gate, so this only rejects names that aren't personas at all.
export const personaSelectSchema = z.object({
	persona: z.enum(["companion", "coach", "examiner"]),
});

export type PersonaSelectBody = z.infer<typeof personaSelectSchema>;
