import { describe, expect, it } from "vitest";

import { cefrToScore, scoreToCefrLabel } from "@/lib/cefr";

describe("cefrToScore", () => {
	it("maps each CEFR level to its 1-indexed ladder position", () => {
		expect(cefrToScore("A1")).toBe(1);
		expect(cefrToScore("A2")).toBe(2);
		expect(cefrToScore("B1")).toBe(3);
		expect(cefrToScore("B2")).toBe(4);
		expect(cefrToScore("C1")).toBe(5);
		expect(cefrToScore("C2")).toBe(6);
	});

	it("returns 0 for null — an honest dip on the radar, not a guessed mid-scale value", () => {
		expect(cefrToScore(null)).toBe(0);
	});

	it("returns 0 for a string that isn't a recognized CEFR level", () => {
		expect(cefrToScore("not-a-level")).toBe(0);
	});
});

describe("scoreToCefrLabel", () => {
	it("round-trips every ladder position back to its CEFR label", () => {
		expect(scoreToCefrLabel(1)).toBe("A1");
		expect(scoreToCefrLabel(6)).toBe("C2");
	});

	it("renders a score of 0 as an em dash, not a fabricated level", () => {
		expect(scoreToCefrLabel(0)).toBe("—");
	});

	it("renders an out-of-range score as an em dash rather than throwing", () => {
		expect(scoreToCefrLabel(7)).toBe("—");
		expect(scoreToCefrLabel(-1)).toBe("—");
	});
});
