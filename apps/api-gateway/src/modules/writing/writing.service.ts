// Writing submission lifecycle from the gateway side: insert the session row
// (the source of truth the worker re-reads), enqueue the pointer job, and
// read results back. Scoring itself lives in ai-service — never here.
import type { DbClient } from "../../db/client";
import { enqueueWritingEval, type WritingEvalQueue } from "../../queue/bullmq-client";

export interface WritingDeps {
	db: DbClient;
	queue: WritingEvalQueue;
}

export interface SubmitInput {
	learnerProfileId: string;
	examType: string;
	promptText: string;
	essayText: string;
}

export interface WritingCategory {
	name: string;
	score: string;
	weight: string;
	feedback: string | null;
}

export interface WritingResult {
	session_id: string;
	status: string;
	exam_type?: string;
	word_count?: number | null;
	// NUMERIC columns stay strings end-to-end (pg returns them as strings,
	// ai-service serializes Decimal as string) — parseFloat would reintroduce
	// the rounding drift NUMERIC(4,2) exists to prevent.
	overall_band_score?: string | null;
	cefr_level?: string | null;
	calibration_version?: string | null;
	submitted_at?: string;
	scored_at?: string | null;
	categories?: WritingCategory[];
	grammar_corrections?: unknown;
	vocabulary_suggestions?: unknown;
}

export function countWords(text: string): number {
	return text.trim().split(/\s+/).filter(Boolean).length;
}

export async function submitWriting(
	deps: WritingDeps,
	input: SubmitInput,
): Promise<{ sessionId: string }> {
	const insert = await deps.db.query(
		`INSERT INTO writing_sessions
			(learner_profile_id, exam_type, prompt_text, essay_text, word_count)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id`,
		[
			input.learnerProfileId,
			input.examType,
			input.promptText,
			input.essayText,
			countWords(input.essayText),
		],
	);
	const sessionId = String(insert.rows[0].id);

	try {
		await enqueueWritingEval(deps.queue, sessionId, input.examType);
	} catch (err) {
		// Don't strand the row as pending-forever if Redis is down — mark it
		// failed so the poll endpoint reports something actionable.
		await deps.db.query(`UPDATE writing_sessions SET status = 'failed' WHERE id = $1`, [
			sessionId,
		]);
		throw err;
	}

	return { sessionId };
}

export async function getWritingResult(
	deps: WritingDeps,
	sessionId: string,
	learnerProfileId: string,
): Promise<WritingResult | null> {
	// Ownership check lives in the WHERE clause: someone else's session id is
	// indistinguishable from an unknown one (404), leaking nothing.
	const { rows } = await deps.db.query(
		`SELECT ws.id, ws.status, ws.exam_type, ws.word_count, ws.overall_band_score,
				ws.cefr_level, ws.calibration_version, ws.submitted_at, ws.scored_at,
				b.category_1_name, b.category_1_score, b.category_1_weight, b.category_1_feedback,
				b.category_2_name, b.category_2_score, b.category_2_weight, b.category_2_feedback,
				b.category_3_name, b.category_3_score, b.category_3_weight, b.category_3_feedback,
				b.category_4_name, b.category_4_score, b.category_4_weight, b.category_4_feedback,
				b.grammar_corrections, b.vocabulary_suggestions
		 FROM writing_sessions ws
		 LEFT JOIN writing_score_breakdowns b ON b.writing_session_id = ws.id
		 WHERE ws.id = $1 AND ws.learner_profile_id = $2`,
		[sessionId, learnerProfileId],
	);
	if (rows.length === 0) return null;

	const row = rows[0];
	const status = String(row.status);
	if (status !== "scored") {
		return { session_id: sessionId, status };
	}

	const categories: WritingCategory[] = [];
	for (const n of [1, 2, 3, 4]) {
		const name = row[`category_${n}_name`];
		// TOEFL's 3-category rubric leaves slot 4 NULL — collapse it.
		if (name == null) continue;
		categories.push({
			name: String(name),
			score: String(row[`category_${n}_score`]),
			weight: String(row[`category_${n}_weight`]),
			feedback: (row[`category_${n}_feedback`] as string | null) ?? null,
		});
	}

	return {
		session_id: sessionId,
		status,
		exam_type: row.exam_type as string,
		word_count: row.word_count as number | null,
		overall_band_score: row.overall_band_score as string | null,
		cefr_level: row.cefr_level as string | null,
		calibration_version: row.calibration_version as string | null,
		submitted_at: row.submitted_at instanceof Date ? row.submitted_at.toISOString() : String(row.submitted_at),
		scored_at:
			row.scored_at == null
				? null
				: row.scored_at instanceof Date
					? row.scored_at.toISOString()
					: String(row.scored_at),
		categories,
		grammar_corrections: row.grammar_corrections ?? [],
		vocabulary_suggestions: row.vocabulary_suggestions ?? [],
	};
}
