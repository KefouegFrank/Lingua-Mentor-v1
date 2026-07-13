import { ShieldCheck } from "lucide-react";
import Link from "next/link";

export interface AuthShellProps {
	title: string;
	description: string;
	children: React.ReactNode;
	footer: React.ReactNode;
}

const TRUST_POINTS = [
	"Writing scored against the same rubric categories real IELTS examiners use",
	"Calibration correlation shown on every score — never a black box",
	"Four skills tracked independently, never averaged into a misleading single number",
];

/**
 * Shared two-panel shell for /login and /register. The branding panel exists
 * to reinforce the product's trust-first positioning (PRD §39) at the exact
 * moment a new user is deciding whether to hand over their email — not
 * decoration for its own sake.
 */
export function AuthShell({ title, description, children, footer }: AuthShellProps) {
	return (
		<div className="grid min-h-screen lg:grid-cols-2">
			<div className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
				<Link href="/" className="text-lg font-bold tracking-tight">
					LinguaMentor
				</Link>
				<div className="space-y-6">
					<h2 className="text-3xl font-bold leading-tight text-balance">
						AI-orchestrated language evaluation, built on trust.
					</h2>
					<ul className="space-y-4">
						{TRUST_POINTS.map((point) => (
							<li key={point} className="flex items-start gap-3 text-sm text-primary-foreground/90">
								<ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
								<span>{point}</span>
							</li>
						))}
					</ul>
				</div>
				<p className="text-xs text-primary-foreground/60">
					© {new Date().getFullYear()} LinguaMentor. Phase 1 — IELTS Academic anchor.
				</p>
			</div>

			<div className="flex flex-col items-center justify-center gap-8 p-6 py-16 sm:p-10">
				<Link href="/" className="text-lg font-bold tracking-tight lg:hidden">
					LinguaMentor
				</Link>
				<div className="w-full max-w-sm space-y-8">
					<div className="space-y-2 text-center sm:text-left">
						<h1 className="text-2xl font-bold tracking-tight">{title}</h1>
						<p className="text-sm text-muted-foreground">{description}</p>
					</div>
					{children}
					<p className="text-center text-sm text-muted-foreground sm:text-left">{footer}</p>
				</div>
			</div>
		</div>
	);
}
