// BullMQ producer — enqueues jobs consumed by apps/worker.
import { Queue } from "bullmq";
import IORedis from "ioredis";

import {
	APPEAL_EVAL_JOB_OPTIONS,
	JOB_APPEAL_EVALUATE,
	JOB_WRITING_EVALUATE,
	QUEUE_APPEAL_EVAL,
	QUEUE_WRITING_EVAL,
	WRITING_EVAL_JOB_OPTIONS,
} from "../config/constants";

/** A pointer, not data: the worker re-reads writing_sessions as the source of
 * truth, so the essay never has a second copy here. `exam_type` is a log label. */
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
	// BullMQ needs an IORedis with maxRetriesPerRequest: null, not a URL string.
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
	// jobId = session_id: idempotent while the record lives (see constants.ts).
	return queue.add(
		JOB_WRITING_EVALUATE,
		{ session_id: sessionId, exam_type: examType },
		{ jobId: sessionId },
	);
}

/** Appeal job payload — a pointer, same contract as WritingEvalJobData: the
 * worker re-reads the score_appeals row as the source of truth. */
export interface AppealEvalJobData {
	appeal_id: string;
}

export interface AppealEvalQueue {
	add(name: string, data: AppealEvalJobData, opts: { jobId: string }): Promise<unknown>;
	close?(): Promise<void>;
}

export function createAppealEvalQueue(redisUrl: string): Queue {
	const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
	return new Queue(QUEUE_APPEAL_EVAL, {
		connection,
		defaultJobOptions: APPEAL_EVAL_JOB_OPTIONS,
	});
}

export function enqueueAppealEval(queue: AppealEvalQueue, appealId: string): Promise<unknown> {
	// jobId = appeal_id — idempotent per appeal, like jobId = session_id above.
	return queue.add(JOB_APPEAL_EVALUATE, { appeal_id: appealId }, { jobId: appealId });
}
