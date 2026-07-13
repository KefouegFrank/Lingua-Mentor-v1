import { ShieldCheck } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export interface CalibrationBannerProps {
	calibrated: boolean;
	calibrationVersion?: string | null;
	/** Verbatim withheld-score explanation from the gateway (writing.service.ts)
	 * — already written as honest, specific copy; never re-paraphrased here. */
	message?: string;
}

/**
 * The trust surface the Phase 0 gate exists to make visible (PRD §21.3,
 * §60): every score report states plainly whether the number shown was
 * produced under an active, human-correlated calibration baseline, or is
 * being withheld because none exists yet. This is not a footnote — it is
 * the product's central credibility claim, so it renders above the score
 * itself, never below.
 */
export function CalibrationBanner({ calibrated, calibrationVersion, message }: CalibrationBannerProps) {
	if (calibrated) {
		return (
			<Alert variant="success">
				<AlertTitle className="flex items-center gap-1.5">
					<ShieldCheck className="h-4 w-4" aria-hidden="true" />
					AI-calibrated score
				</AlertTitle>
				<AlertDescription>
					This score was produced under an active Phase 0 calibration baseline
					{calibrationVersion ? (
						<>
							{" "}
							(<span className="font-mono text-xs">{calibrationVersion}</span>)
						</>
					) : null}
					, which requires ≥0.85 correlation against certified human examiners before any
					score ships to a learner.
				</AlertDescription>
			</Alert>
		);
	}

	return (
		<Alert variant="warning">
			<AlertTitle>Score withheld — pending calibration</AlertTitle>
			<AlertDescription>
				{message ??
					"Your response was evaluated, but AI scoring for this exam has not yet passed Phase 0 calibration, so a band score is withheld."}
			</AlertDescription>
		</Alert>
	);
}
