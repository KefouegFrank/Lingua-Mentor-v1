// Writing evaluation endpoints (Master PRD §35.4): async submit + poll.
// Registered under /api/v1/writing in app.ts.
import type { FastifyInstance } from "fastify";

import { AppError } from "../../plugins/error-envelope";
import {
	learnerProfileIdHeaderSchema,
	sessionIdParamSchema,
	submitBodySchema,
} from "./writing.schema";
import { getWritingResult, submitWriting } from "./writing.service";

// TODO(slice-5): replace with the learner_profile_id claim from the verified
// JWT once the auth service lands; the header is a dev-interim identity.
function requireLearnerProfileId(headers: Record<string, unknown>): string {
	const raw = headers["x-learner-profile-id"];
	const parsed = learnerProfileIdHeaderSchema.safeParse(raw);
	if (!parsed.success) {
		throw new AppError(
			400,
			"VALIDATION_ERROR",
			"x-learner-profile-id header must be a UUID",
			"x-learner-profile-id",
		);
	}
	return parsed.data;
}

export default async function writingRoutes(app: FastifyInstance): Promise<void> {
	// TODO(slice-6): enforce the free-tier quota (3 evaluations/month, PRD §5.1)
	// here once subscription tiers are readable from the JWT.
	app.post("/submit", async (request, reply) => {
		const learnerProfileId = requireLearnerProfileId(request.headers);
		const body = submitBodySchema.parse(request.body);

		const { sessionId } = await submitWriting(
			{ db: app.db, queue: app.writingQueue },
			{
				learnerProfileId,
				examType: body.exam_type,
				promptText: body.prompt_text,
				essayText: body.essay_text,
			},
		);

		return reply.status(202).send({ session_id: sessionId, status: "pending" });
	});

	app.get("/result/:session_id", async (request) => {
		const learnerProfileId = requireLearnerProfileId(request.headers);
		const { session_id } = sessionIdParamSchema.parse(request.params);

		const result = await getWritingResult(
			{ db: app.db, queue: app.writingQueue },
			session_id,
			learnerProfileId,
		);
		if (!result) {
			throw new AppError(404, "NOT_FOUND", "writing session not found");
		}
		return result;
	});
}
