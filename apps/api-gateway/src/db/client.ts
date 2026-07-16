// Postgres client connection to Neon. Region should match the Neon project
// region chosen in deployment patch §3.1 to minimize round-trip latency.
import { Pool, type PoolClient } from "pg";

/** The bit of the client a transaction callback is allowed to touch. */
export interface Queryable {
	query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

/** Narrow surface the app depends on, so tests can fake it without Postgres. */
export interface DbClient extends Queryable {
	/** Runs `fn` on one connection inside BEGIN/COMMIT — for writes that must
	 * land together, like a user row and its learner_profiles row. */
	transaction<T>(this: void, fn: (tx: Queryable) => Promise<T>): Promise<T>;
	end?(): Promise<void>;
}

function wrapPool(pool: Pool): DbClient {
	return {
		query: (text, params) => pool.query(text, params),
		async transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
			const client: PoolClient = await pool.connect();
			try {
				await client.query("BEGIN");
				const result = await fn({ query: (text, params) => client.query(text, params) });
				await client.query("COMMIT");
				return result;
			} catch (err) {
				await client.query("ROLLBACK");
				throw err;
			} finally {
				client.release();
			}
		},
		end: () => pool.end(),
	};
}

export function createPool(databaseUrl: string): DbClient {
	// Small pool — Neon's PgBouncer absorbs concurrency upstream (ADR 0001 §3.1).
	return wrapPool(new Pool({ connectionString: databaseUrl, max: 10 }));
}
