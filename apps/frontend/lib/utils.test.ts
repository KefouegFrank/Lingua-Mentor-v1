import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
	it("joins plain class names", () => {
		expect(cn("btn", "btn-primary")).toBe("btn btn-primary");
	});

	it("drops falsy values from conditional class expressions", () => {
		const isActive = false;
		expect(cn("btn", isActive && "btn-active", null, undefined, "")).toBe("btn");
	});

	it("lets the last conflicting Tailwind utility win instead of keeping both", () => {
		// Why cn() exists over clsx: otherwise both utilities land and the
		// cascade, not call order, picks the winner.
		expect(cn("p-2", "p-4")).toBe("p-4");
	});

	it("merges conditional object syntax the same way clsx does", () => {
		expect(cn({ "text-red-500": true, "text-blue-500": false })).toBe("text-red-500");
	});
});
