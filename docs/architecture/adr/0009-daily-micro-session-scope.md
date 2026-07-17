# LinguaMentor — Daily Micro-Session: Schedule, Pre-Generation Scope, Phase 1 Shape

**Document type:** Architecture decision record
**Patches:** Master PRD §23.3 (Daily scheduler), §33 (`srs_daily` cache row, TTL), §35.3 (daily-diagnostic response)
**Phase:** Phase 1 — Core Platform (§61, "Daily micro-session endpoint")
**Status:** Accepted
**Last updated:** 2026-07-17

---

## 1. Context

§61 requires a "Daily micro-session endpoint: pre-generation at 2AM UTC, Redis cache per learner".
Three things need settling before it can be built.

**The schedule is stated two ways.** §23.3 says "SRS state evaluated at midnight UTC per learner.
Next-day session content pre-generated and cached", and §33 says "Pre-recomputed for next day at
midnight UTC". §50, §51, §59 and §61 all say 2AM UTC — and §50 gives the reason ("morning traffic
spike"), while §51 gives the target it buys ("Daily SRS generation < 200 ms, served from cache").

**The specified response reaches three phases forward.** §35.3's example returns
`readiness_before: { score, projected_band }`. The Readiness Prediction Engine is a §61 **Phase 4**
deliverable, and ADR 0004 defers all of it bar Model A. Nothing in Phase 1 can compute that field.

**Pre-generation has a per-learner cost.** `daily_sessions.ai_model_run_id` is `NOT NULL`
(`ondelete="RESTRICT"`), so a daily session cannot exist without a real inference call. Generating
one nightly for every registered learner spends tokens on every dormant free-tier account, against
§55's ceiling: "Monthly AI cost per user must remain below 40% of Pro subscription". §61 says when
to pre-generate but never for whom.

## 2. Decision

### 2.1 The batch runs at 2AM UTC; the day it generates for is the UTC calendar day

Both readings survive, because they describe different things. Midnight UTC is the **date
boundary** — `daily_sessions.session_date` is a `DATE`, so "today" rolls over at 00:00 UTC by
definition, and no job is needed to make that true. 2AM UTC is when the **batch job runs** to fill
that day. §59 and §61 are the delivery specs and both say 2AM; §50 and §51 explain why (off-peak,
ahead of the morning spike). §23.3's "midnight" describes the rollover it pairs with generation in
one sentence; this ADR separates the two.

### 2.2 Pre-generation covers recently-active learners only

The nightly batch generates for learners active in the **last 14 days**. Everyone else gets their
session generated on demand, on first request.

§35.3 already specifies the endpoint as "**Trigger** or retrieve" — on-demand generation is in the
contract, not a workaround. Pre-generation is a latency optimisation (§51: < 200 ms from cache), and
the learner it optimises for is one who opens the app. A dormant account pays one slower first load
instead of 365 unopened inferences a year, which is the difference between §55's ceiling holding and
not. The window is a single constant, not a branch.

This is a deliberate narrowing of "pre-generation at 2AM UTC", which §61 states without a
population. Anyone reading §61 alone will expect every learner to be covered.

### 2.3 Activity is `users.last_active_at`, written on login *and* refresh

`last_login_at` cannot answer "did this learner open the app recently". Opening the app runs the
silent-refresh bootstrap, not a login; `refreshSession` never writes `last_login_at`; and refresh
tokens rotate with a fresh 7-day TTL on every use. A learner who opens the app weekly therefore stays
signed in indefinitely with `last_login_at` frozen at their first ever login — so a 14-day window
over that column would exclude the *most* engaged learners and pre-generate for nobody else. It is
not merely coarse, it is inverted.

A new nullable `users.last_active_at` is written by both `loginUser` and `refreshSession`. That makes
it mean "last opened the app", which is the question §2.2 is asking. `last_login_at` keeps its
literal meaning and its §37 audit role.

### 2.4 One session per learner per UTC day is enforced by the database

`daily_sessions` ships with `ix_daily_sessions_learner_date` — a plain index, `unique=False`. Nothing
stops the 2AM batch and a 09:00 on-demand request from both writing a row for the same learner and
date. A `UNIQUE (learner_profile_id, session_date)` constraint is added, and the generation write
uses `ON CONFLICT DO NOTHING` so the loser of a race reads the winner's row rather than failing.

Idempotency stated in prose is not idempotency.

### 2.5 Phase 1 omits `readiness_before`

The field is absent from the Phase 1 response rather than sent as a null, zero or placeholder. A
readiness score is a claim about the learner's exam prospects; inventing one to satisfy a response
shape is the same class of error as shipping an uncalibrated band, which the Phase 0 gate exists to
prevent. `daily_sessions.readiness_delta` stays nullable and unwritten until Phase 4 fills it.

`pre_session_score` and `srs_priority_score` are Phase 1 data and are returned.

### 2.6 Cache key is `srs_daily:{learner_profile_id}`, expiring at the next UTC midnight

The key is §33's. Distinct from `srs_state:{learner_id}` (ADR 0008 / §23.3), which caches the
*ranking*; this caches the *generated session*. The two have different lifetimes and must not share
a key.

§33's flat "24 hours" TTL is wrong for a key with no date in it. `session_date` rolls at 00:00 UTC,
so a session written by the 2AM batch and given 24 hours lives until 02:00 the following day —
serving *yesterday's* drill for today's date every morning between 00:00 and 02:00. The TTL is
instead the seconds remaining until the next UTC midnight, which keeps §33's 24 hours as the ceiling
it reads as while expiring on the boundary that actually matters. This is the same midnight/2AM
split as §2.1: midnight bounds the day, 2AM fills it.

The cached value additionally carries its `session_date` and readers discard a value whose date is
not today. TTLs are an optimisation; correctness cannot depend on Redis expiring a key on time.

Both PRD keys say `{learner_id}`; the value used is the **learner_profile_id**, which is what every
session-scoped table keys off and what the JWT carries as `lpid`. `users.id` never appears in a
session path.

### 2.7 The gateway owns the 2AM schedule; the worker only consumes it

The Python `bullmq` client (2.25.3) exposes no scheduler or repeat API — `Queue` offers `add` and
`addBulk` and nothing recurring. The Node gateway (bullmq 5.79.3) has Job Schedulers, which replaced
the deprecated `repeat` option in 5.16.0. A scheduler is a producer-side factory that emits ordinary
jobs, and Python and Node queues are interoperable (identical Lua scripts), so the worker consumes
what the gateway schedules without needing the API itself.

The gateway upserts `daily-session-batch` with `{ pattern: "0 2 * * *", tz: "UTC" }` on boot;
`upsertJobScheduler` is idempotent by id, so every replica may do it. (`tz` reaches `RepeatOptions`
via `cron-parser`'s `ParserOptions`, which is why BullMQ's own option page omits it.)

The scheduled job fans out — it enqueues one generation job per active learner rather than
generating inline. A thousand learners at ~3s each is fifty minutes in one job where a single
learner's failure retries all of them; fanned out, failures and retries isolate per learner and
worker concurrency does the work.

## 3. Consequences

- A learner returning after 14+ days waits for a live generation on first open. Acceptable: they
  waited two weeks, and §35.3's trigger path is the documented behaviour.
- The batch's cost scales with active learners, not registrations — the only version of this that
  stays inside §55.
- Phase 4 must add `readiness_before` to this response and start writing `readiness_delta`. The
  field's absence is the marker for that work.
- Two Redis keys now describe "SRS" state. The names come from the PRD; the split is real.
- `last_active_at` starts NULL for every existing account, so nobody is pre-generated for until they
  next open the app. Correct — an account that has not been opened since this shipped has not
  demonstrated it will be.
- The gateway now writes to `users` on every refresh. That is one extra UPDATE on a hot path; it is
  a single indexed primary-key write and buys the only honest activity signal available.
- A recurring schedule now exists in the system for the first time. It lives in Redis, not in code,
  so changing the cron means an `upsertJobScheduler` deploy, not a config file — and an orphaned
  scheduler id would keep firing until explicitly removed.
