import { describe, expect, it } from "vitest";

import { bearerHeader, buildTestApp, makeFakeAiService, signTestAccessToken } from "./helpers";

describe("GET /api/v1/writing/exams", () => {
	it("proxies ai-service's rubric metadata unchanged", async () => {
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
		const { app, jwt } = await buildTestApp({ aiService });
		const token = await signTestAccessToken(jwt);

		const res = await app.inject({
			method: "GET",
			url: "/api/v1/writing/exams",
			headers: bearerHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual(exams);
		expect(aiService.calls).toEqual([{ method: "listExams", args: undefined }]);
	});

	it("rejects a request with no bearer token", async () => {
		const { app } = await buildTestApp();

		const res = await app.inject({ method: "GET", url: "/api/v1/writing/exams" });

		expect(res.statusCode).toBe(401);
	});
});
