import { readFileSync } from "node:fs";

import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";

import { type AiServiceClient, createAiServiceClient } from "./clients/ai-service";
import { loadEnv } from "./config/env";
import { createPool, type DbClient } from "./db/client";
import authRoutes from "./modules/auth/auth.routes";
import { JwtStrategy } from "./modules/auth/jwt.strategy";
import placementRoutes from "./modules/placement/placement.routes";
import usersRoutes from "./modules/users/users.routes";
import writingRoutes, { writingPublicRoutes } from "./modules/writing/writing.routes";
import { registerErrorEnvelope } from "./plugins/error-envelope";
import {
	type AppealEvalQueue,
	createAppealEvalQueue,
	createWritingEvalQueue,
	type WritingEvalQueue,
} from "./queue/bullmq-client";
import { createRedisKv, type RedisKv } from "./redis/client";

declare module "fastify" {
	interface FastifyInstance {
		db: DbClient;
		writingQueue: WritingEvalQueue;
		appealQueue: AppealEvalQueue;
		redis: RedisKv;
		jwt: JwtStrategy;
		calibrationGateEnforced: boolean;
		aiService: AiServiceClient;
	}
}

export interface AppOptions {
	// Test seams — production wiring is the default for anything omitted.
	db?: DbClient;
	queue?: WritingEvalQueue;
	appealQueue?: AppealEvalQueue;
	redis?: RedisKv;
	jwt?: JwtStrategy;
	enforceCalibrationGate?: boolean;
	aiService?: AiServiceClient;
	corsOrigins?: string[];
}

export function buildApp(opts: AppOptions = {}): FastifyInstance {
	const app = Fastify({ logger: true });

	// Called directly, not via app.register — Fastify v5 scopes error handlers
	// to the registering plugin, and the §34.1 envelope must be global.
	registerErrorEnvelope(app);

	// Cookie parsing has to be available before any route that reads or sets
	// one — registered at root, ahead of every route plugin below.
	app.register(fastifyCookie);

	let db = opts.db;
	let queue = opts.queue;
	let appealQueue = opts.appealQueue;
	let redis = opts.redis;
	let jwt = opts.jwt;
	let enforceCalibrationGate = opts.enforceCalibrationGate;
	let aiService = opts.aiService;
	let corsOrigins = opts.corsOrigins;
	if (!db || !queue || !appealQueue || !redis || !jwt || !aiService || !corsOrigins) {
		const env = loadEnv();
		db = db ?? createPool(env.databaseUrl);
		queue = queue ?? createWritingEvalQueue(env.redisUrl);
		appealQueue = appealQueue ?? createAppealEvalQueue(env.redisUrl);
		redis = redis ?? createRedisKv(env.redisUrl);
		jwt =
			jwt ??
			new JwtStrategy(
				readFileSync(env.jwtPrivateKeyPath, "utf-8"),
				readFileSync(env.jwtPublicKeyPath, "utf-8"),
			);
		enforceCalibrationGate = enforceCalibrationGate ?? env.enforceCalibrationGate;
		aiService = aiService ?? createAiServiceClient(env.aiServiceUrl);
		corsOrigins = corsOrigins ?? env.corsOrigins;
	}

	// credentials: true is required for the refresh cookie to travel
	// cross-origin (the frontend runs on its own port in dev, its own
	// subdomain in prod) — an explicit origin allowlist, never "*", is the
	// only combination browsers permit once credentials are involved.
	app.register(fastifyCors, { origin: corsOrigins, credentials: true });

	app.decorate("db", db);
	app.decorate("writingQueue", queue);
	app.decorate("appealQueue", appealQueue);
	app.decorate("redis", redis);
	app.decorate("jwt", jwt);
	app.decorate("aiService", aiService);
	// Fail-closed: if nothing set it (e.g. a test that doesn't opt out), the
	// gate is on — see loadEnv's ENFORCE_CALIBRATION_GATE comment.
	app.decorate("calibrationGateEnforced", enforceCalibrationGate ?? true);

	app.addHook("onClose", async () => {
		await app.writingQueue.close?.();
		await app.appealQueue.close?.();
		await app.redis.quit?.();
		await app.db.end?.();
	});

	// Basic health endpoint used by the frontend and infra checks
	app.get("/health", async (_request, _reply) => {
		return { status: "ok", uptime: process.uptime() };
	});

	app.register(authRoutes, { prefix: "/api/v1/auth" });
	app.register(usersRoutes, { prefix: "/api/v1/user" });
	app.register(writingPublicRoutes, { prefix: "/api/v1/writing" });
	app.register(writingRoutes, { prefix: "/api/v1/writing" });
	app.register(placementRoutes, { prefix: "/api/v1/placement" });

	return app;
}
  