// Queue names MUST match apps/worker/app/worker_settings.py 1:1 — the worker
// resolves its processor by queue name, so a rename here without a matching
// rename there silently strands jobs.
export const QUEUE_WRITING_EVAL = "writing_eval";

// BullMQ job name within the queue (a queue may carry more job types later).
export const JOB_WRITING_EVALUATE = "evaluate";

export const WRITING_EVAL_JOB_OPTIONS = {
	// 3 attempts with exponential backoff covers transient LLM-provider 502s
	// (the worker re-raises those); permanent 400s complete on attempt 1
	// without retry — see apps/worker/app/tasks/writing_eval_task.py.
	attempts: 3,
	backoff: { type: "exponential", delay: 5_000 },
	// Completed job records only need to live long enough to dedupe
	// re-submits (jobId = session_id); failed jobs are kept for inspection.
	removeOnComplete: { age: 3_600, count: 1_000 },
	removeOnFail: false,
} as const;
