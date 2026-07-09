// Test fakes for the injected dependencies (DbClient, WritingEvalQueue,
// RedisKv, JwtStrategy). Fakes record every call so tests assert on SQL
// params, job payloads, and cache writes; the JWT strategy is the real
// implementation running against an ephemeral keypair, not a fake — signing
// and verifying is exactly the behaviour under test.
import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";

import { buildApp, type AppOptions } from "../src/app";
import type { DbClient, Queryable } from "../src/db/client";
import { type AccessTokenClaims, JwtStrategy } from "../src/modules/auth/jwt.strategy";
import type { WritingEvalJobData, WritingEvalQueue } from "../src/queue/bullmq-client";
import type { RedisKv } from "../src/redis/client";

export interface RecordedQuery {
	text: string;
	params?: unknown[];
}

export interface FakeDb extends DbClient {
	calls: RecordedQuery[];
}

/**
 * Routes queries by substring match against the SQL text; unmatched queries
 * return zero rows. Handlers run in registration order, first match wins.
 * A handler can also `throw` to simulate a driver-level error (e.g. a
 * Postgres unique-violation with `code: "23505"`).
 */
export function makeFakeDb(
	handlers: Array<{ match: string; rows?: Record<string, unknown>[]; throws?: unknown }> = [],
): FakeDb {
	const calls: RecordedQuery[] = [];
	const query = async (text: string, params?: unknown[]) => {
		calls.push({ text, params });
		const handler = handlers.find((h) => text.includes(h.match));
		if (handler?.throws) throw handler.throws;
		return { rows: handler?.rows ?? [] };
	};
	return {
		calls,
		query,
		// No real BEGIN/COMMIT here — the fake just runs the callback against
		// the same recording query fn, since tests only care that the right
		// statements were issued, not that Postgres actually isolated them.
		async transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
			return fn({ query });
		},
	};
}

export interface RecordedJob {
	name: string;
	data: WritingEvalJobData;
	opts: { jobId: string };
}

export interface FakeQueue extends WritingEvalQueue {
	jobs: RecordedJob[];
}

export function makeFakeQueue(opts: { failWith?: Error } = {}): FakeQueue {
	const jobs: RecordedJob[] = [];
	return {
		jobs,
		async add(name, data, jobOpts) {
			if (opts.failWith) throw opts.failWith;
			jobs.push({ name, data, opts: jobOpts });
			return { id: jobOpts.jobId };
		},
	};
}

export interface FakeRedis extends RedisKv {
	store: Map<string, string>;
	ttls: Map<string, number>;
}

export function makeFakeRedis(): FakeRedis {
	const store = new Map<string, string>();
	const ttls = new Map<string, number>();
	return {
		store,
		ttls,
		async setex(key, ttlSeconds, value) {
			store.set(key, value);
			ttls.set(key, ttlSeconds);
		},
		async getdel(key) {
			const value = store.get(key) ?? null;
			store.delete(key);
			ttls.delete(key);
			return value;
		},
		async del(key) {
			store.delete(key);
			ttls.delete(key);
		},
	};
}

export interface TestJwtMaterial {
	jwt: JwtStrategy;
	privateKeyPem: string;
	publicKeyPem: string;
}

/**
 * A real JwtStrategy backed by a freshly generated, throwaway RS256
 * keypair — signing/verifying is the thing under test, so faking it would
 * test nothing. `extractable: true` is required or `exportPKCS8` throws;
 * jose's default keys aren't exportable.
 *
 * Returns the raw PEMs too, alongside the strategy: a couple of refresh-flow
 * tests need to hand-craft a token (e.g. one that's already expired) rather
 * than go through JwtStrategy's fixed TTLs.
 */
export async function makeTestJwtMaterial(): Promise<TestJwtMaterial> {
	const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
	const privateKeyPem = await exportPKCS8(privateKey);
	const publicKeyPem = await exportSPKI(publicKey);
	return { jwt: new JwtStrategy(privateKeyPem, publicKeyPem), privateKeyPem, publicKeyPem };
}

export async function makeTestJwt(): Promise<JwtStrategy> {
	return (await makeTestJwtMaterial()).jwt;
}

const DEFAULT_TEST_CLAIMS: AccessTokenClaims = {
	sub: "1c2d3e4f-5555-4666-8777-88889999aaaa",
	role: "learner",
	tier: "free",
	lpid: "7b3e2a10-1111-4222-8333-444455556666",
};

export async function signTestAccessToken(
	jwt: JwtStrategy,
	overrides: Partial<AccessTokenClaims> = {},
): Promise<string> {
	return jwt.signAccessToken({ ...DEFAULT_TEST_CLAIMS, ...overrides });
}

export function bearerHeader(token: string): { authorization: string } {
	return { authorization: `Bearer ${token}` };
}

export interface TestApp {
	app: ReturnType<typeof buildApp>;
	db: FakeDb;
	queue: FakeQueue;
	redis: FakeRedis;
	jwt: JwtStrategy;
}

/** Builds a fully-wired app with fakes for every injected dependency,
 * generating a fresh test JwtStrategy unless one is supplied. */
export async function buildTestApp(
	opts: Partial<AppOptions> & { db?: FakeDb; queue?: FakeQueue; redis?: FakeRedis } = {},
): Promise<TestApp> {
	const db = opts.db ?? makeFakeDb();
	const queue = opts.queue ?? makeFakeQueue();
	const redis = opts.redis ?? makeFakeRedis();
	const jwt = opts.jwt ?? (await makeTestJwt());
	// Spread opts first so extra AppOptions (e.g. enforceCalibrationGate) flow
	// through; the resolved fakes below win over any same-named keys.
	const app = buildApp({ ...opts, db, queue, redis, jwt });
	return { app, db, queue, redis, jwt };
}

export const LEARNER_PROFILE_ID = DEFAULT_TEST_CLAIMS.lpid;
export const SESSION_ID = "0a1b2c3d-aaaa-4bbb-8ccc-ddddeeeeffff";
export const USER_ID = DEFAULT_TEST_CLAIMS.sub;
