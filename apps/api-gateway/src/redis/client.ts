// Small key-value seam over Redis for auth session state (refresh-token
// liveness). Deliberately narrow — the BullMQ queue owns its own Redis
// connection (src/queue/bullmq-client.ts); this one is just for
// SETEX/GETDEL/DEL, so it's trivial to fake in tests without dragging in a
// real BullMQ-flavoured mock.
import IORedis from "ioredis";

export interface RedisKv {
	setex(key: string, ttlSeconds: number, value: string): Promise<void>;
	/** Atomically reads and deletes a key in one round trip — the primitive
	 * refresh-token rotation relies on: a token can be redeemed exactly once. */
	getdel(key: string): Promise<string | null>;
	del(key: string): Promise<void>;
	quit?(): Promise<void>;
}

export function createRedisKv(redisUrl: string): RedisKv {
	const client = new IORedis(redisUrl);
	return {
		async setex(key, ttlSeconds, value) {
			await client.setex(key, ttlSeconds, value);
		},
		async getdel(key) {
			// ioredis exposes GETDEL directly (Redis >=6.2, which infra runs).
			return client.getdel(key);
		},
		async del(key) {
			await client.del(key);
		},
		async quit() {
			await client.quit();
		},
	};
}
