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

// Score appeal secondary evaluation (PRD §21.4) — same producer/consumer
// naming contract as writing_eval above.
export const QUEUE_APPEAL_EVAL = "appeal_eval";
export const JOB_APPEAL_EVALUATE = "evaluate";

export const APPEAL_EVAL_JOB_OPTIONS = {
	// Same retry envelope as writing_eval: the appeal SLA is <60s (PRD §21.4),
	// and 3 attempts × 5s exponential backoff stays comfortably inside it.
	attempts: 3,
	backoff: { type: "exponential", delay: 5_000 },
	removeOnComplete: { age: 3_600, count: 1_000 },
	removeOnFail: false,
} as const;

// --- Auth ---
// Named after the platform, not the deploy environment — verifiers reject
// tokens from any other issuer even if they were signed with the right key.
export const JWT_ISSUER = "linguamentor";

// Short-lived on purpose: a leaked access token self-expires fast. The
// refresh token is what actually carries session length.
export const ACCESS_TOKEN_TTL = "15m";
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

// The cookie is scoped to /api/v1/auth so it's never sent on unrelated
// requests (writing submissions, dashboard reads, etc.) — only the
// endpoints that need to rotate or revoke it ever see it.
export const REFRESH_COOKIE_NAME = "lm_refresh";
export const REFRESH_COOKIE_PATH = "/api/v1/auth";

// Redis key prefix for the "this refresh token is still live" marker —
// see src/modules/auth/auth.service.ts for the rotation logic.
export const REFRESH_KEY_PREFIX = "refresh:";
