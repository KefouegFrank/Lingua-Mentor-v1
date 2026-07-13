import { ChevronDown } from "lucide-react";
import { forwardRef, type SelectHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

// A styled native <select> rather than a Radix/headless combobox: every use
// in this app is a short, flat option list (exam type, accent, persona) with
// no search or multi-select need — native select is fully keyboard and
// screen-reader accessible for free, and pulling in a combobox primitive for
// this would be dependency weight with no behavioral upside.
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
	({ className, children, ...props }, ref) => {
		return (
			<div className="relative">
				<select
					ref={ref}
					className={cn(
						"flex h-10 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-9 text-sm shadow-sm",
						"transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
						"disabled:cursor-not-allowed disabled:opacity-50",
						className,
					)}
					{...props}
				>
					{children}
				</select>
				<ChevronDown
					className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
					aria-hidden="true"
				/>
			</div>
		);
	},
);
Select.displayName = "Select";
