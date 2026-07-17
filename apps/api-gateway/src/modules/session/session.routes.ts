// Session & adaptive endpoints (PRD §35.3) — registered under /api/v1/session.
import type { FastifyInstance } from "fastify";

import { authenticate } from "../../middleware/authenticate";
import { getSrsSchedule } from "./session.service";

export default async function sessionRoutes(app: FastifyInstance): Promise<void> {
	// Scoped to this plugin only — see src/middleware/authenticate.ts.
	app.addHook("preHandler", authenticate);

	app.get("/srs-schedule", async (request) => {
		return getSrsSchedule(
			{ aiService: app.aiService, redis: app.redis },
			request.user!.learnerProfileId,
		);
	});
}
