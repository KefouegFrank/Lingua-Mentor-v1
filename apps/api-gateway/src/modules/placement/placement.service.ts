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
	enforceCalibrationGate: boolean,
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

	// Phase 0 gate (PRD §60): a placement CEFR level is a user-facing AI
	// evaluation like any other — it must not be produced from an uncalibrated
	// scorer. Refusing *before* the LLM call (rather than withholding after)
	// means nothing uncalibrated is ever stored on the profile, and no tokens
	// are spent on a result we would refuse to show.
	if (enforceCalibrationGate) {
		const baseline = await deps.db.query(
			`SELECT 1 FROM calibration_baselines
			 WHERE exam_type = $1 AND displayed_on_reports = true
			 LIMIT 1`,
			[targetExam],
		);
		if (baseline.rows.length === 0) {
			throw new AppError(
				409,
				"AWAITING_CALIBRATION",
				"The placement test isn't available yet: AI scoring for your target exam " +
					"is still being calibrated against certified human examiners. " +
					"You'll be able to take it as soon as calibration is confirmed.",
			);
		}
	}

	return deps.aiService.evaluatePlacement({
		learnerProfileId: input.learnerProfileId,
		examType: String(targetExam),
		promptText: input.promptText,
		essayText: input.essayText,
	});
}
