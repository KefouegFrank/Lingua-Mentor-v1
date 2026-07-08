// BullMQ producer — enqueues jobs consumed by apps/worker.
import { Queue } from "bullmq";
import IORedis from "ioredis";

import {
	JOB_WRITING_EVALUATE,
	QUEUE_WRITING_EVAL,
	WRITING_EVAL_JOB_OPTIONS,
} from "../config/constants";

/**
 * The job payload is a pointer, not data: the worker re-reads the
 * writing_sessions row from Postgres as the source of truth, so the queue
 * never carries a second copy of the essay that could drift from the DB.
 * `exam_type` rides along purely for log labels.
 */
export interface WritingEvalJobData {
	session_id: string;
	exam_type: string;
}

/** Narrow surface the app depends on, so tests can substitute a fake. */
export interface WritingEvalQueue {
	add(
		name: string,
		data: WritingEvalJobData,
		opts: { jobId: string },
	): Promise<unknown>;
	close?(): Promise<void>;
}

export function createWritingEvalQueue(redisUrl: string): Queue {
	// BullMQ requires an IORedis instance with maxRetriesPerRequest: null —
	// a bare URL string is not a valid `connection` option.
	const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
	return new Queue(QUEUE_WRITING_EVAL, {
		connection,
		defaultJobOptions: WRITING_EVAL_JOB_OPTIONS,
	});
}

export function enqueueWritingEval(
	queue: WritingEvalQueue,
	sessionId: string,
	examType: string,
): Promise<unknown> {
	// jobId = session_id makes enqueueing idempotent while the job record
	// lives in Redis (see removeOnComplete in constants.ts).
	return queue.add(
		JOB_WRITING_EVALUATE,
		{ session_id: sessionId, exam_type: examType },
		{ jobId: sessionId },
	);
}
