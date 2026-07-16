import { describe, expect, it } from "vitest";

import { bearerHeader, buildTestApp, makeFakeDb, signTestAccessToken } from "./helpers";

describe("global error envelope (PRD §34.1)", () => {
	it("wraps unknown routes in a 404 envelope", async () => {
		const { app } = await buildTestApp();

		const res = await app.inject({ method: "GET", url: "/api/v1/nope" });

		expect(res.statusCode).toBe(404);
		expect(res.json().error.code).toBe("NOT_FOUND");
	});

	it("reports a JSON content-type with an empty body as a 400, not a 500", async () => {
		// Regression: FST_ERR_CTP_EMPTY_JSON_BODY is a 400 but has no `validation`
		// property, so it used to fall through to the catch-all 500 branch.
		const { app } = await buildTestApp();

		const res = await app.inject({
			method: "POST",
			url: "/api/v1/auth/refresh",
			headers: { "content-type": "application/json" },
			body: "",
		});

		expect(res.statusCode).toBe(400);
		expect(res.json().error.code).toBe("FST_ERR_CTP_EMPTY_JSON_BODY");
	});

	it("wraps unexpected errors in a 500 envelope without leaking internals", async () => {
		const db = makeFakeDb();
		db.query = async () => {
			throw new Error("pg: connection refused at 10.0.0.5");
		};
		const { app, jwt } = await buildTestApp({ db });
		const token = await signTestAccessToken(jwt);

		const res = await app.inject({
			method: "GET",
			url: "/api/v1/writing/result/0a1b2c3d-aaaa-4bbb-8ccc-ddddeeeeffff",
			headers: bearerHeader(token),
		});

		expect(res.statusCode).toBe(500);
		expect(res.json()).toEqual({
			error: { code: "INTERNAL_ERROR", message: "internal server error" },
		});
	});
});
