// Placement submission: resolve the learner's chosen exam, hand the essay to
// ai-service for scoring, and return the initialized 4D CEFR profile. Scoring
// and profile logic live in ai-service — this layer only wires auth + context.
import type { AiServiceClient, CefrProfileDto } from "../../clients/ai-service";
import type { DbClient } from "../../db/client";
import { AppError } from "../../plugins/error-envelope";

export interface PlacementDeps {
	db: DbClient;
	aiService: AiServiceClient;
}

export interface PlacementInput {
	learnerProfileId: string;
	promptText: string;
	essayText: string;
}

export async function submitPlacement(
	deps: PlacementDeps,
	input: PlacementInput,
): Promise<CefrProfileDto> {
	// The placement essay is scored against the learner's target exam rubric,
	// chosen at signup. No target exam means there's no rubric to score against.
	const { rows } = await deps.db.query(
		`SELECT target_exam FROM learner_profiles WHERE id = $1`,
		[input.learnerProfileId],
	);
	const targetExam = rows[0]?.target_exam;
	if (!targetExam) {
		throw new AppError(400, "NO_TARGET_EXAM", "set a target exam before taking the placement test");
	}

	return deps.aiService.evaluatePlacement({
		learnerProfileId: input.learnerProfileId,
		examType: String(targetExam),
		promptText: input.promptText,
		essayText: input.essayText,
	});
}
