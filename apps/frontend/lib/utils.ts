import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merges conditional class names and resolves Tailwind conflicts (the last
 * conflicting utility wins) — the standard composition primitive every UI
 * component below is built on. */
export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}
