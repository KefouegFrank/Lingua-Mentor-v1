import { Clock, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

export type CefrSource = "assessed" | "proxy" | "pending";

export interface CefrBadgeProps {
	level: string | null;
	source: CefrSource;
	className?: string;
}

/**
 * Renders a CEFR level with source-honest styling — the 4D profile (PRD §22)
 * only ever shows a level as solid fact when it's `assessed`. `proxy` and
 * `pending` render visibly differently (dashed border, muted tone, a small
 * icon) so a learner never mistakes an estimate or an unbuilt skill for a
 * real measurement. This mirrors the same honesty the backend's
 * `cefr_profile` engine builds in — the UI must not paper over it.
 */
export function CefrBadge({ level, source, className }: CefrBadgeProps) {
	if (source === "pending" || !level) {
		return (
			<span
				className={cn(
					"inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground",
					className,
				)}
			>
				<Clock className="h-3 w-3" aria-hidden="true" />
				Not yet available
			</span>
		);
	}

	const bandClass = `cefr-${level.toLowerCase()}`;
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
				bandClass,
				className,
			)}
		>
			{source === "proxy" && <Sparkles className="h-3 w-3 opacity-70" aria-hidden="true" />}
			{level}
			{source === "proxy" && <span className="font-normal opacity-70">(est.)</span>}
		</span>
	);
}
