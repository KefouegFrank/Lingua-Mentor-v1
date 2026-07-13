// Writing evaluation endpoints (Master PRD §35.4): async submit + poll.
// Registered under /api/v1/writing in app.ts.
import type { FastifyInstance } from "fastify";

import { authenticate } from "../../middleware/authenticate";
import { AppError } from "../../plugins/error-envelope";
import {
	appealBodySchema,
	appealIdParamSchema,
	sessionIdParamSchema,
	submitBodySchema,
} from "./writing.schema";
import { getAppeal, getWritingResult, submitAppeal, submitWriting } from "./writing.service";

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
			app.calibrationGateEnforced,
		);
		if (!result) {
			throw new AppError(404, "NOT_FOUND", "writing session not found");
		}
		return result;
	});

	// Score appeal (PRD §21.4, §35.4): flag a scored session for an async
	// secondary evaluation. Eligibility rules live in submitAppeal.
	// TODO(slice-6): appeal is a Pro-tier feature (PRD §5.1) — enforce
	// request.user.tier here alongside the submit quota, when billing lands.
	app.post("/appeal/:session_id", async (request, reply) => {
		const { session_id } = sessionIdParamSchema.parse(request.params);
		const body = appealBodySchema.parse(request.body ?? undefined);

		const { appealId } = await submitAppeal(
			{ db: app.db, appealQueue: app.appealQueue },
			session_id,
			request.user!.learnerProfileId,
			body?.appeal_reason ?? null,
			app.calibrationGateEnforced,
		);

		return reply.status(202).send({ appeal_id: appealId, status: "pending" });
	});

	app.get("/appeal/:appeal_id", async (request) => {
		const { appeal_id } = appealIdParamSchema.parse(request.params);

		const appeal = await getAppeal({ db: app.db }, appeal_id, request.user!.learnerProfileId);
		if (!appeal) {
			throw new AppError(404, "NOT_FOUND", "appeal not found");
		}
		return appeal;
	});
}
