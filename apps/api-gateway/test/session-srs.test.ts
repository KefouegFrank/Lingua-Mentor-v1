import { describe, expect, it } from "vitest";

import { SRS_STATE_KEY_PREFIX, SRS_STATE_TTL_SECONDS } from "../src/config/constants";
import {
	DEFAULT_SRS_SCHEDULE,
	LEARNER_PROFILE_ID,
	bearerHeader,
	buildTestApp,
	makeFakeAiService,
	makeFakeRedis,
	signTestAccessToken,
} from "./helpers";

const SRS_URL = "/api/v1/session/srs-schedule";
const CACHE_KEY = `${SRS_STATE_KEY_PREFIX}${LEARNER_PROFILE_ID}`;

describe("GET /api/v1/session/srs-schedule (PRD §35.3)", () => {
	it("returns the ranked schedule for the learner in the JWT", async () => {
		const aiService = makeFakeAiService();
		const { app, jwt } = await buildTestApp({ aiService });
		const token = await signTestAccessToken(jwt);

		const res = await app.inject({ method: "GET", url: SRS_URL, headers: bearerHeader(token) });

		expect(res.statusCode).toBe(200);
		expect(res.json().next_dimension).toBe("vocabulary");
		// The learner id comes from the token, never from the caller.
		expect(aiService.calls).toEqual([{ method: "getSrsSchedule", args: LEARNER_PROFILE_ID }]);
	});

	it("caches the schedule under the PRD §23.3 key", async () => {
		const redis = makeFakeRedis();
		const { app, jwt } = await buildTestApp({ redis });
		const token = await signTestAccessToken(jwt);

		await app.inject({ method: "GET", url: SRS_URL, headers: bearerHeader(token) });

		expect(JSON.parse(redis.store.get(CACHE_KEY)!)).toEqual(DEFAULT_SRS_SCHEDULE);
		expect(redis.ttls.get(CACHE_KEY)).toBe(SRS_STATE_TTL_SECONDS);
	});

	it("serves a cached schedule without re-asking ai-service", async () => {
		const redis = makeFakeRedis();
		const aiService = makeFakeAiService();
		const { app, jwt } = await buildTestApp({ redis, aiService });
		const token = await signTestAccessToken(jwt);

		await app.inject({ method: "GET", url: SRS_URL, headers: bearerHeader(token) });
		await app.inject({ method: "GET", url: SRS_URL, headers: bearerHeader(token) });

		expect(aiService.calls).toHaveLength(1);
	});

	it("reads the cache without consuming it", async () => {
		// getdel is for refresh tokens; a cache that spends its own key on read
		// would miss on every second request.
		const redis = makeFakeRedis();
		const { app, jwt } = await buildTestApp({ redis });
		const token = await signTestAccessToken(jwt);

		await app.inject({ method: "GET", url: SRS_URL, headers: bearerHeader(token) });
		await app.inject({ method: "GET", url: SRS_URL, headers: bearerHeader(token) });

		expect(redis.store.has(CACHE_KEY)).toBe(true);
	});

	it("still answers when Redis is down", async () => {
		// A cache outage should cost latency, not the feature.
		const redis = makeFakeRedis();
		redis.get = async () => {
			throw new Error("redis down");
		};
		redis.setex = async () => {
			throw new Error("redis down");
		};
		const { app, jwt } = await buildTestApp({ redis });
		const token = await signTestAccessToken(jwt);

		const res = await app.inject({ method: "GET", url: SRS_URL, headers: bearerHeader(token) });

		expect(res.statusCode).toBe(200);
		expect(res.json().next_dimension).toBe("vocabulary");
	});

	it("surfaces an ai-service failure through the gateway envelope", async () => {
		const { AppError } = await import("../src/plugins/error-envelope");
		const aiService = makeFakeAiService({
			srsError: new AppError(404, "NOT_FOUND", "learner profile not found"),
		});
		const { app, jwt } = await buildTestApp({ aiService });
		const token = await signTestAccessToken(jwt);

		const res = await app.inject({ method: "GET", url: SRS_URL, headers: bearerHeader(token) });

		expect(res.statusCode).toBe(404);
		expect(res.json().error.code).toBe("NOT_FOUND");
	});

	it("rejects a request with no bearer token", async () => {
		const { app } = await buildTestApp();

		const res = await app.inject({ method: "GET", url: SRS_URL });

		expect(res.statusCode).toBe(401);
	});
});
