// Test fakes for the two injected dependencies (DbClient, WritingEvalQueue).
// Fakes record every call so tests assert on SQL params and job payloads.
import type { DbClient } from "../src/db/client";
import type { WritingEvalJobData, WritingEvalQueue } from "../src/queue/bullmq-client";

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
 */
export function makeFakeDb(
	handlers: Array<{ match: string; rows: Record<string, unknown>[] }> = [],
): FakeDb {
	const calls: RecordedQuery[] = [];
	return {
		calls,
		async query(text: string, params?: unknown[]) {
			calls.push({ text, params });
			const handler = handlers.find((h) => text.includes(h.match));
			return { rows: handler ? handler.rows : [] };
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

export const LEARNER_PROFILE_ID = "7b3e2a10-1111-4222-8333-444455556666";
export const SESSION_ID = "0a1b2c3d-aaaa-4bbb-8ccc-ddddeeeeffff";
