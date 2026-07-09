import { describe, expect, it } from "vitest";

import { bearerHeader, buildTestApp, makeFakeDb, signTestAccessToken } from "./helpers";

describe("global error envelope (PRD §34.1)", () => {
	it("wraps unknown routes in a 404 envelope", async () => {
		const { app } = await buildTestApp();

		const res = await app.inject({ method: "GET", url: "/api/v1/nope" });

		expect(res.statusCode).toBe(404);
		expect(res.json().error.code).toBe("NOT_FOUND");
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
