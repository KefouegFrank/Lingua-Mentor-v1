import Fastify, { type FastifyInstance } from "fastify";

import { loadEnv } from "./config/env";
import { createPool, type DbClient } from "./db/client";
import writingRoutes from "./modules/writing/writing.routes";
import { registerErrorEnvelope } from "./plugins/error-envelope";
import { createWritingEvalQueue, type WritingEvalQueue } from "./queue/bullmq-client";

declare module "fastify" {
	interface FastifyInstance {
		db: DbClient;
		writingQueue: WritingEvalQueue;
	}
}

export interface AppOptions {
	// Test seams — production wiring is the default.
	db?: DbClient;
	queue?: WritingEvalQueue;
}

export function buildApp(opts: AppOptions = {}): FastifyInstance {
	const app = Fastify({ logger: true });

	// Called directly, not via app.register — Fastify v5 scopes error handlers
	// to the registering plugin, and the §34.1 envelope must be global.
	registerErrorEnvelope(app);

	let db = opts.db;
	let queue = opts.queue;
	if (!db || !queue) {
		const env = loadEnv();
		db = db ?? createPool(env.databaseUrl);
		queue = queue ?? createWritingEvalQueue(env.redisUrl);
	}
	app.decorate("db", db);
	app.decorate("writingQueue", queue);

	app.addHook("onClose", async () => {
		await app.writingQueue.close?.();
		await app.db.end?.();
	});

	// Basic health endpoint used by the frontend and infra checks
	app.get("/health", async (_request, _reply) => {
		return { status: "ok", uptime: process.uptime() };
	});

	app.register(writingRoutes, { prefix: "/api/v1/writing" });

	return app;
}
