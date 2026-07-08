// Postgres client connection to Neon. Region should match the Neon project
// region chosen in deployment patch §3.1 to minimize round-trip latency.
import { Pool } from "pg";

/**
 * Narrow surface the app depends on, so tests can substitute a fake without
 * spinning up Postgres. `pg.Pool` satisfies it structurally.
 */
export interface DbClient {
	query(text: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
	end?(): Promise<void>;
}

export function createPool(databaseUrl: string): Pool {
	// Small pool — Neon's PgBouncer absorbs concurrency upstream (ADR 0001 §3.1).
	return new Pool({ connectionString: databaseUrl, max: 10 });
}
