// Writing evaluation endpoints (Master PRD §35.4): async submit + poll.
// Registered under /api/v1/writing in app.ts.
import type { FastifyInstance } from "fastify";

import { authenticate } from "../../middleware/authenticate";
import { AppError } from "../../plugins/error-envelope";
import { sessionIdParamSchema, submitBodySchema } from "./writing.schema";
import { getWritingResult, submitWriting } from "./writing.service";

export default async function writingRoutes(app: FastifyInstance): Promise<void> {
	// Scoped to this plugin only — see src/middleware/authenticate.ts.
	app.addHook("preHandler", authenticate);

	// TODO(slice-6): enforce the free-tier quota (3 evaluations/month, PRD
	// §5.1) here now that request.user.tier comes from a verified JWT.
	app.post("/submit", async (request, reply) => {
		const body = submitBodySchema.parse(request.body);

		const { sessionId } = await submitWriting(
			{ db: app.db, queue: app.writingQueue },
			{
				learnerProfileId: request.user!.learnerProfileId,
				examType: body.exam_type,
				promptText: body.prompt_text,
				essayText: body.essay_text,
			},
		);

		return reply.status(202).send({ session_id: sessionId, status: "pending" });
	});

	app.get("/result/:session_id", async (request) => {
		const { session_id } = sessionIdParamSchema.parse(request.params);

		const result = await getWritingResult(
			{ db: app.db, queue: app.writingQueue },
			session_id,
			request.user!.learnerProfileId,
		);
		if (!result) {
			throw new AppError(404, "NOT_FOUND", "writing session not found");
		}
		return result;
	});
}
