// Queue and job names MUST match apps/worker/app/worker_settings.py 1:1 — the
// worker resolves its processor by name, so a one-sided rename strands jobs.
export const QUEUE_WRITING_EVAL = "writing_eval";
export const JOB_WRITING_EVALUATE = "evaluate";

export const WRITING_EVAL_JOB_OPTIONS = {
	attempts: 3,
	backoff: { type: "exponential", delay: 5_000 },
	// jobId = session_id, so completed records double as the re-submit dedupe.
	removeOnComplete: { age: 3_600, count: 1_000 },
	removeOnFail: false,
} as const;

export const QUEUE_APPEAL_EVAL = "appeal_eval";
export const JOB_APPEAL_EVALUATE = "evaluate";

export const APPEAL_EVAL_JOB_OPTIONS = {
	attempts: 3,
	backoff: { type: "exponential", delay: 5_000 },
	removeOnComplete: { age: 3_600, count: 1_000 },
	removeOnFail: false,
} as const;

// --- Auth ---
// The platform, not the deploy environment — verifiers reject other issuers.
export const JWT_ISSUER = "linguamentor";

// Short on purpose: session length comes from the refresh token, not this.
export const ACCESS_TOKEN_TTL = "15m";
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export const REFRESH_COOKIE_NAME = "lm_refresh";
// Scoped so only the endpoints that rotate or revoke it ever see the cookie.
export const REFRESH_COOKIE_PATH = "/api/v1/auth";

export const REFRESH_KEY_PREFIX = "refresh:";

// --- SRS ---
export const SRS_STATE_KEY_PREFIX = "srs_state:";

export const SRS_STATE_TTL_SECONDS = 60 * 60; // PRD §33

// --- Daily micro-session ---
export const SRS_DAILY_KEY_PREFIX = "srs_daily:";

export const QUEUE_SRS_BATCH_GENERATION = "srs_batch_generation";
export const QUEUE_DAILY_SESSION_GENERATION = "daily_session_generation";
export const JOB_SRS_BATCH_GENERATE = "generate";
export const JOB_DAILY_SESSION_GENERATE = "generate";

// Idempotent by id, so every replica may upsert it on boot.
export const SRS_BATCH_SCHEDULER_ID = "daily-session-batch";
export const SRS_BATCH_CRON = "0 2 * * *";
export const SRS_BATCH_TZ = "UTC";

export const PREGENERATION_ACTIVE_WINDOW_DAYS = 14;

export const DAILY_SESSION_JOB_OPTIONS = {
	// Nobody is waiting on this: one retry, then leave it for tomorrow rather
	// than hammer the provider once per learner in the batch.
	attempts: 2,
	backoff: { type: "exponential", delay: 30_000 },
	removeOnComplete: { age: 86_400, count: 5_000 },
	removeOnFail: { age: 604_800 },
} as const;
