// The learner's first AI interaction: fetch the task, submit a writing sample,
// get back the initialized 4D CEFR profile.
import type { FastifyInstance } from "fastify";

import { authenticate } from "../../middleware/authenticate";
import { placementSubmitSchema } from "./placement.schema";
import { getPlacementTask, submitPlacement } from "./placement.service";

export default async function placementRoutes(app: FastifyInstance): Promise<void> {
	// Scoped to this plugin only — see src/middleware/authenticate.ts.
	app.addHook("preHandler", authenticate);

	app.get("/task", async (request) => {
		return getPlacementTask(
			{ db: app.db, aiService: app.aiService },
			request.user!.learnerProfileId,
			app.calibrationGateEnforced,
		);
	});

	app.post("/submit", async (request) => {
		const body = placementSubmitSchema.parse(request.body);
		return submitPlacement(
			{ db: app.db, aiService: app.aiService },
			{
				learnerProfileId: request.user!.learnerProfileId,
				taskId: body.task_id,
				essayText: body.essay_text,
			},
			app.calibrationGateEnforced,
		);
	});
}
