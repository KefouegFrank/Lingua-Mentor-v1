// CEFR ladder helpers: level → plottable number. Ordinal only (A1=1 … C2=6),
// no calibration meaning — just for placing a level on a chart axis.
export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

/** null/unrecognized → 0, which plots as an honest dip on the radar rather
 * than guessing a mid-scale value for a skill with no data yet. */
export function cefrToScore(level: string | null): number {
	const index = CEFR_LEVELS.indexOf(level as CefrLevel);
	return index === -1 ? 0 : index + 1;
}

export function scoreToCefrLabel(score: number): string {
	return score === 0 ? "—" : (CEFR_LEVELS[score - 1] ?? "—");
}
