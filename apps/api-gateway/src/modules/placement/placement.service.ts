// Placement submission: resolve the target exam, hand the essay to ai-service,
// return the initialized 4D CEFR profile. Scoring logic lives in ai-service.
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
	// Scored against the target exam's rubric — no target exam, no rubric.
	const { rows } = await deps.db.query(
		`SELECT target_exam FROM learner_profiles WHERE id = $1`,
		[input.learnerProfileId],
	);
	const targetExam = rows[0]?.target_exam;
	if (!targetExam) {
		throw new AppError(400, "NO_TARGET_EXAM", "set a target exam before taking the placement test");
	}

	// Phase 0 gate (PRD §60): refuse before the LLM call, not after, so nothing
	// uncalibrated is stored and no tokens go to a result we'd refuse to show.
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
