"use client";

import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/** An Input with a visibility toggle — every password field in the app
 * (login, register) uses this instead of duplicating the show/hide button. */
export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
	({ className, ...props }, ref) => {
		const [visible, setVisible] = useState(false);
		return (
			<div className="relative">
				<input
					ref={ref}
					type={visible ? "text" : "password"}
					className={cn(
						"flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm shadow-sm",
						"transition-colors placeholder:text-muted-foreground",
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
						"disabled:cursor-not-allowed disabled:opacity-50",
						className,
					)}
					{...props}
				/>
				<button
					type="button"
					onClick={() => setVisible((v) => !v)}
					className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					tabIndex={-1}
					aria-label={visible ? "Hide password" : "Show password"}
				>
					{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
				</button>
			</div>
		);
	},
);
PasswordInput.displayName = "PasswordInput";
