// MUST match apps/worker/app/worker_settings.py 1:1 — the worker resolves its
// processor by queue name, so a one-sided rename silently strands jobs.
export const QUEUE_WRITING_EVAL = "writing_eval";

// BullMQ job name within the queue (a queue may carry more job types later).
export const JOB_WRITING_EVALUATE = "evaluate";

export const WRITING_EVAL_JOB_OPTIONS = {
	// Covers transient LLM-provider 502s; permanent 400s don't retry — see
	// apps/worker/app/tasks/writing_eval_task.py.
	attempts: 3,
	backoff: { type: "exponential", delay: 5_000 },
	// Completed records live just long enough to dedupe re-submits (jobId =
	// session_id); failed jobs are kept for inspection.
	removeOnComplete: { age: 3_600, count: 1_000 },
	removeOnFail: false,
} as const;

// Score appeal secondary evaluation (PRD §21.4) — same naming contract as above.
export const QUEUE_APPEAL_EVAL = "appeal_eval";
export const JOB_APPEAL_EVALUATE = "evaluate";

export const APPEAL_EVAL_JOB_OPTIONS = {
	// Same envelope as writing_eval — stays inside the <60s appeal SLA (PRD §21.4).
	attempts: 3,
	backoff: { type: "exponential", delay: 5_000 },
	removeOnComplete: { age: 3_600, count: 1_000 },
	removeOnFail: false,
} as const;

// --- Auth ---
// The platform, not the deploy environment: verifiers reject other issuers
// even when the signing key checks out.
export const JWT_ISSUER = "linguamentor";

// Short on purpose — a leaked access token self-expires fast. Session length
// comes from the refresh token instead.
export const ACCESS_TOKEN_TTL = "15m";
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

// Scoped so only the endpoints that rotate or revoke the cookie ever see it.
export const REFRESH_COOKIE_NAME = "lm_refresh";
export const REFRESH_COOKIE_PATH = "/api/v1/auth";

// Marks a refresh token as still live — rotation logic in auth.service.ts.
export const REFRESH_KEY_PREFIX = "refresh:";
