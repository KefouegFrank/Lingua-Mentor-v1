import { readFileSync } from "node:fs";

import fastifyCookie from "@fastify/cookie";
import Fastify, { type FastifyInstance } from "fastify";

import { loadEnv } from "./config/env";
import { createPool, type DbClient } from "./db/client";
import authRoutes from "./modules/auth/auth.routes";
import { JwtStrategy } from "./modules/auth/jwt.strategy";
import usersRoutes from "./modules/users/users.routes";
import writingRoutes from "./modules/writing/writing.routes";
import { registerErrorEnvelope } from "./plugins/error-envelope";
import { createWritingEvalQueue, type WritingEvalQueue } from "./queue/bullmq-client";
import { createRedisKv, type RedisKv } from "./redis/client";

declare module "fastify" {
	interface FastifyInstance {
		db: DbClient;
		writingQueue: WritingEvalQueue;
		redis: RedisKv;
		jwt: JwtStrategy;
		calibrationGateEnforced: boolean;
	}
}

export interface AppOptions {
	// Test seams — production wiring is the default for anything omitted.
	db?: DbClient;
	queue?: WritingEvalQueue;
	redis?: RedisKv;
	jwt?: JwtStrategy;
	enforceCalibrationGate?: boolean;
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
	let redis = opts.redis;
	let jwt = opts.jwt;
	let enforceCalibrationGate = opts.enforceCalibrationGate;
	if (!db || !queue || !redis || !jwt) {
		const env = loadEnv();
		db = db ?? createPool(env.databaseUrl);
		queue = queue ?? createWritingEvalQueue(env.redisUrl);
		redis = redis ?? createRedisKv(env.redisUrl);
		jwt =
			jwt ??
			new JwtStrategy(
				readFileSync(env.jwtPrivateKeyPath, "utf-8"),
				readFileSync(env.jwtPublicKeyPath, "utf-8"),
			);
		enforceCalibrationGate = enforceCalibrationGate ?? env.enforceCalibrationGate;
	}
	app.decorate("db", db);
	app.decorate("writingQueue", queue);
	app.decorate("redis", redis);
	app.decorate("jwt", jwt);
	// Fail-closed: if nothing set it (e.g. a test that doesn't opt out), the
	// gate is on — see loadEnv's ENFORCE_CALIBRATION_GATE comment.
	app.decorate("calibrationGateEnforced", enforceCalibrationGate ?? true);

	app.addHook("onClose", async () => {
		await app.writingQueue.close?.();
		await app.redis.quit?.();
		await app.db.end?.();
	});

	// Basic health endpoint used by the frontend and infra checks
	app.get("/health", async (_request, _reply) => {
		return { status: "ok", uptime: process.uptime() };
	});

	app.register(authRoutes, { prefix: "/api/v1/auth" });
	app.register(usersRoutes, { prefix: "/api/v1/user" });
	app.register(writingRoutes, { prefix: "/api/v1/writing" });

	return app;
}
