import { describe, expect, it } from "vitest";

import { cn, countWords } from "@/lib/utils";

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

describe("countWords", () => {
	it("counts words separated by any run of whitespace", () => {
		expect(countWords("the cat   sat\non the\t\tmat")).toBe(6);
	});

	it("counts an empty or whitespace-only essay as zero", () => {
		expect(countWords("")).toBe(0);
		expect(countWords("   \n\t ")).toBe(0);
	});

	it("ignores leading and trailing whitespace", () => {
		expect(countWords("  hello world  ")).toBe(2);
	});
});
