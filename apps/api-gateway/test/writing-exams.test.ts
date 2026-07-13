import { describe, expect, it } from "vitest";

import { buildTestApp, makeFakeAiService } from "./helpers";

describe("GET /api/v1/writing/exams", () => {
	it("proxies ai-service's rubric metadata unchanged, with no auth required", async () => {
		// Public on purpose: the registration form needs the exam list to
		// populate its target-exam field before an account exists.
		const exams = [
			{
				exam_id: "delf_b1",
				display_name: "DELF B1",
				language: "fr",
				task_name: "Production Écrite",
				categories: [{ key: "coherence", name: "Cohérence", weight: "0.250" }],
			},
		];
		const aiService = makeFakeAiService({ exams });
		const { app } = await buildTestApp({ aiService });

		const res = await app.inject({ method: "GET", url: "/api/v1/writing/exams" });

		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual(exams);
		expect(aiService.calls).toEqual([{ method: "listExams", args: undefined }]);
	});
});
