// SETEX/GETDEL/DEL seam for refresh-token liveness, kept narrow so tests can
// fake it. The BullMQ queue owns its own connection (queue/bullmq-client.ts).
import IORedis from "ioredis";

export interface RedisKv {
	setex(key: string, ttlSeconds: number, value: string): Promise<void>;
	/** Atomic read-and-delete: what makes a refresh token redeemable once. */
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
