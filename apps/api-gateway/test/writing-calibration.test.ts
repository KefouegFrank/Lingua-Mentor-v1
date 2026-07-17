import { describe, expect, it } from "vitest";

import { bearerHeader, buildTestApp, makeFakeDb, signTestAccessToken } from "./helpers";

const CALIBRATION_URL = "/api/v1/writing/calibration";

const BASELINE_ROW = {
	calibration_version: "v1.0-launch",
	sample_count: 247,
	// NUMERIC(5,4) comes back from pg as a string.
	overall_pearson: "0.8800",
	calibration_date: new Date("2026-07-01T00:00:00Z"),
};

function calibrationDb(opts: { targetExam?: string | null; baseline?: boolean } = {}) {
	const { targetExam = "ielts_academic", baseline = true } = opts;
	return makeFakeDb([
		{ match: "FROM learner_profiles", rows: [{ target_exam: targetExam }] },
		{ match: "FROM calibration_baselines", rows: baseline ? [BASELINE_ROW] : [] },
	]);
}

describe("GET /api/v1/writing/calibration (PRD §35.4)", () => {
	it("returns the correlation and sample count for the learner's target exam", async () => {
		const db = calibrationDb();
		const { app, jwt } = await buildTestApp({ db });
		const token = await signTestAccessToken(jwt);

		const res = await app.inject({
			method: "GET",
			url: CALIBRATION_URL,
			headers: bearerHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(res.json()).toMatchObject({
			exam_type: "ielts_academic",
			calibrated: true,
			calibration_version: "v1.0-launch",
			sample_count: 247,
			// Pearson r stays a string — same no-drift rule as band scores.
			overall_pearson: "0.8800",
		});
	});

	it("reports uncalibrated as an answer rather than an error", async () => {
		const db = calibrationDb({ baseline: false });
		const { app, jwt } = await buildTestApp({ db });
		const token = await signTestAccessToken(jwt);

		const res = await app.inject({
			method: "GET",
			url: CALIBRATION_URL,
			headers: bearerHeader(token),
		});

		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({ exam_type: "ielts_academic", calibrated: false });
	});

	it("returns 400 NO_TARGET_EXAM when the learner has no exam set", async () => {
		const db = calibrationDb({ targetExam: null });
		const { app, jwt } = await buildTestApp({ db });
		const token = await signTestAccessToken(jwt);

		const res = await app.inject({
			method: "GET",
			url: CALIBRATION_URL,
			headers: bearerHeader(token),
		});

		expect(res.statusCode).toBe(400);
		expect(res.json().error.code).toBe("NO_TARGET_EXAM");
	});

	it("rejects a request with no bearer token", async () => {
		const { app } = await buildTestApp();

		const res = await app.inject({ method: "GET", url: CALIBRATION_URL });

		expect(res.statusCode).toBe(401);
	});
});
