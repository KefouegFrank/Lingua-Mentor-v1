// Any REST endpoints related to voice sessions (e.g. session history), not the WS handler itself.
// Phase 1 ships persona selection only (PRD §35.3) — registered under /api/v1/voice.
import type { FastifyInstance } from "fastify";

import { authenticate } from "../../middleware/authenticate";
import { personaSelectSchema } from "./voice.schema";
import { getPersonaState, selectPersona } from "./voice.service";

export default async function voiceRoutes(app: FastifyInstance): Promise<void> {
	// Scoped to this plugin only — see src/middleware/authenticate.ts.
	app.addHook("preHandler", authenticate);

	app.get("/persona/current", async (request) => {
		return getPersonaState(
			{ db: app.db, aiService: app.aiService },
			request.user!.learnerProfileId,
			request.user!.tier,
		);
	});

	app.post("/persona/select", async (request) => {
		const body = personaSelectSchema.parse(request.body);
		return selectPersona(
			{ db: app.db, aiService: app.aiService },
			request.user!.learnerProfileId,
			request.user!.tier,
			body.persona,
		);
	});
}
