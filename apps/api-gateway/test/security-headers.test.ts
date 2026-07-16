import { describe, expect, it } from "vitest";

import { buildTestApp } from "./helpers";

describe("security headers", () => {
	it("sets them on every response, including errors the router never reached", async () => {
		const { app } = await buildTestApp();

		const res = await app.inject({ method: "GET", url: "/no-such-route" });

		expect(res.statusCode).toBe(404);
		expect(res.headers["x-content-type-options"]).toBe("nosniff");
		expect(res.headers["strict-transport-security"]).toContain("max-age=");
		expect(res.headers["referrer-policy"]).toBe("no-referrer");
	});

	it("locks the CSP down to a JSON API's needs rather than helmet's HTML default", async () => {
		const { app } = await buildTestApp();

		const res = await app.inject({ method: "GET", url: "/health" });

		expect(res.headers["content-security-policy"]).toBe(
			"default-src 'none';frame-ancestors 'none'",
		);
	});

	it("still answers a browser preflight from an allowed origin", async () => {
		// Helmet sets Cross-Origin-Resource-Policy: same-origin by default, which
		// must not start refusing the frontend's credentialed cross-origin calls.
		const { app } = await buildTestApp();

		const res = await app.inject({
			method: "OPTIONS",
			url: "/api/v1/auth/login",
			headers: {
				origin: "http://localhost:3001",
				"access-control-request-method": "POST",
			},
		});

		expect(res.statusCode).toBe(204);
		expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3001");
		expect(res.headers["access-control-allow-credentials"]).toBe("true");
	});
});
