// Placement test endpoint (PRD §22.3) — registered under /api/v1/placement.
// The learner's first AI interaction: submit a writing sample, get back the
// initialized 4D CEFR profile.
import type { FastifyInstance } from "fastify";

import { authenticate } from "../../middleware/authenticate";
import { placementSubmitSchema } from "./placement.schema";
import { submitPlacement } from "./placement.service";

export default async function placementRoutes(app: FastifyInstance): Promise<void> {
	// Scoped to this plugin only — see src/middleware/authenticate.ts.
	app.addHook("preHandler", authenticate);

	app.post("/submit", async (request) => {
		const body = placementSubmitSchema.parse(request.body);
		return submitPlacement(
			{ db: app.db, aiService: app.aiService },
			{
				learnerProfileId: request.user!.learnerProfileId,
				promptText: body.prompt_text,
				essayText: body.essay_text,
			},
		);
	});
}
