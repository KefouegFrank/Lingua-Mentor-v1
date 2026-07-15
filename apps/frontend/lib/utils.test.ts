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
		// This is the whole reason cn() exists over a plain clsx() call — two
		// conflicting padding utilities would otherwise both land in the
		// class list and the browser's cascade order (not call order) would
		// decide which one wins.
		expect(cn("p-2", "p-4")).toBe("p-4");
	});

	it("merges conditional object syntax the same way clsx does", () => {
		expect(cn({ "text-red-500": true, "text-blue-500": false })).toBe("text-red-500");
	});
});
