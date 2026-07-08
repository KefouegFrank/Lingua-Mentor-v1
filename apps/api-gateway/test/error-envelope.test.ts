import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app";
import { makeFakeDb, makeFakeQueue } from "./helpers";

describe("global error envelope (PRD §34.1)", () => {
	it("wraps unknown routes in a 404 envelope", async () => {
		const app = buildApp({ db: makeFakeDb(), queue: makeFakeQueue() });

		const res = await app.inject({ method: "GET", url: "/api/v1/nope" });

		expect(res.statusCode).toBe(404);
		expect(res.json().error.code).toBe("NOT_FOUND");
	});

	it("wraps unexpected errors in a 500 envelope without leaking internals", async () => {
		const db = makeFakeDb();
		db.query = async () => {
			throw new Error("pg: connection refused at 10.0.0.5");
		};
		const app = buildApp({ db, queue: makeFakeQueue() });

		const res = await app.inject({
			method: "GET",
			url: "/api/v1/writing/result/0a1b2c3d-aaaa-4bbb-8ccc-ddddeeeeffff",
			headers: { "x-learner-profile-id": "7b3e2a10-1111-4222-8333-444455556666" },
		});

		expect(res.statusCode).toBe(500);
		expect(res.json()).toEqual({
			error: { code: "INTERNAL_ERROR", message: "internal server error" },
		});
	});
});
