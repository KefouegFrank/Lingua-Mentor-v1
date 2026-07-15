"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { NAV_ITEMS, SETTINGS_ITEM } from "@/components/dashboard/nav-config";
import { cn } from "@/lib/utils";

export interface NavLinksProps {
	/** Called after navigating — the mobile drawer passes its own close
	 * handler here so tapping a link closes the overlay; the desktop
	 * sidebar passes nothing since there's no overlay to dismiss. */
	onNavigate?: () => void;
}

/** The nav item list itself — rendered inside both the fixed desktop
 * sidebar and the mobile drawer, so route-active styling and the
 * live/soon distinction only exist in one place. */
export function NavLinks({ onNavigate }: NavLinksProps) {
	const pathname = usePathname();

	return (
		<nav className="flex flex-1 flex-col gap-1">
			{NAV_ITEMS.map((item) => {
				const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
				if (item.status === "soon") {
					return (
						<div
							key={item.href}
							className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/60"
							aria-disabled="true"
						>
							<item.icon className="h-4 w-4" aria-hidden="true" />
							<span className="flex-1">{item.label}</span>
							<Badge variant="outline" className="text-[10px] font-normal">
								Soon
							</Badge>
						</div>
					);
				}
				return (
					<Link
						key={item.href}
						href={item.href}
						onClick={onNavigate}
						className={cn(
							"flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
							isActive
								? "bg-primary/10 text-primary"
								: "text-muted-foreground hover:bg-secondary hover:text-foreground",
						)}
						aria-current={isActive ? "page" : undefined}
					>
						<item.icon className="h-4 w-4" aria-hidden="true" />
						{item.label}
					</Link>
				);
			})}

			<div className="mt-auto pt-4">
				<Link
					href={SETTINGS_ITEM.href}
					onClick={onNavigate}
					className={cn(
						"flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
						pathname === SETTINGS_ITEM.href
							? "bg-primary/10 text-primary"
							: "text-muted-foreground hover:bg-secondary hover:text-foreground",
					)}
				>
					<SETTINGS_ITEM.icon className="h-4 w-4" aria-hidden="true" />
					{SETTINGS_ITEM.label}
				</Link>
			</div>
		</nav>
	);
}
