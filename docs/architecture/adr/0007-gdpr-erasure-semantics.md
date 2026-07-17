# LinguaMentor — GDPR Erasure Semantics and Endpoint

**Document type:** Architecture decision record
**Patches:** Master PRD §52.1 (Right-to-erasure row)
**Phase:** Phase 1 — Core Platform (§61, "Auth service: … GDPR erasure endpoint")
**Status:** Accepted
**Last updated:** 2026-07-16

---

## 1. Context

Phase 1 (§61) requires a GDPR erasure endpoint. The PRD specifies it in three places, and they
do not agree:

| Section | Path | Semantics |
| --- | --- | --- |
| §10.5 Data Privacy Requirements | not stated | "deletes PII, removes audio blobs, **anonymizes AIModelRun logs**, and retains only aggregated anonymized metrics" |
| §35.2 User & Profile Endpoints | `DELETE /api/v1/user/me` | "anonymize PII, delete audio, **deactivate account**" |
| §52.1 Security Architecture | `DELETE /api/v1/user/erase` | "**Purges**: user row, learner_profile, all sessions, all skill vectors, **all AI trace logs**" |

§28 adds "Soft deletes for all user-facing entities. Hard deletes reserved for GDPR erasure
requests. Deleted records retain anonymized aggregate data for analytics."

Two conflicts must be resolved before the endpoint can be built: the **path**
(`/user/me` vs `/user/erase`), and the **fate of `ai_model_runs`** (anonymize vs purge).

The schema has already answered the second one. `ai_model_runs` carries no foreign key to
`learner_profiles` — only opaque ids — so nothing cascades into it, which is §10.5's "PII
separation" expressed in DDL. `writing_score_breakdown.ai_model_run_id` is
`ForeignKey(..., ondelete="RESTRICT")`: the database actively refuses to delete a trace row a
score still references. `users.gdpr_erasure_requested_at` exists as a state column. §52.1's
purge is not implementable without dismantling the guard protecting the calibration audit trail.

## 2. Decision

### 2.1 The endpoint is `DELETE /api/v1/user/me` (§35.2 wins over §52.1)

§35 is the client-facing API contract and the section the frontend is built against; §52.1 is a
one-line entry in a security-controls table. `/user/me` also composes with the `GET`/`PATCH`
verbs already specified on the same resource. `DELETE /api/v1/user/erase` is withdrawn.

### 2.2 Erasure anonymises and deactivates; it does not purge (§10.5 + §35.2 win over §52.1)

Erasure is a state transition on `users`, not a row delete:

- `email` → a unique, non-routable placeholder (`.invalid`, RFC 2606)
- `display_name` → a fixed placeholder
- `password_hash` → a fresh Argon2 hash of an unknowable random secret (see §2.4)
- `is_active` → `false`; `gdpr_erasure_requested_at` → `now()`

`learner_profiles` and score rows survive. Once the identifying fields are gone they are the
"aggregated anonymized metrics" §10.5 and §28 both say to retain.

### 2.3 `ai_model_runs` rows are retained untouched

§10.5 is explicit ("anonymizes AIModelRun logs"), and the rows hold no personal data to begin
with — opaque ids, prompt/response hashes, token counts, latencies. Under GDPR Recital 26,
anonymous data is outside the Regulation's scope, so purging them satisfies no Article 17
obligation.

It would, however, cost the product its evidence base. §60 requires `calibration_version` to be
"immutable and referenced in all AIModelRun logs from launch day," and ADR 0006 §2.4 put
data-pipeline integrity into the Go/No-Go. A Pearson correlation computed over a corpus that any
user can silently remove rows from is not a defensible gate. Erasure must not be a lever on
calibration evidence.

### 2.4 User-authored free text is purged, not retained

§10.5 retains "**only** aggregated anonymized metrics". Free text is not a metric, and it can
carry identifying content regardless of §28.2's assertion that PII lives only on `users` — a
learner may name themselves in an essay. On erasure the following are cleared:

- `writing_sessions.prompt_text`, `writing_sessions.essay_text`
- `writing_score_breakdown.category_{1..4}_feedback` — the grader is instructed to quote the
  essay, so feedback is a re-identification vector
- `score_appeals.appeal_reason`
- `speaking_sessions.transcript_text` (column exists; unreachable until Phase 2)

Band scores, CEFR levels and timestamps remain.

`password_hash` gets a hash of a random secret rather than an empty string because
`auth.service.ts` runs `argon2.verify` against the stored value *before* testing `is_active` —
an invalid hash would raise there and turn a login attempt into a 500 instead of a 401.

### 2.5 "Delete audio" is a no-op in Phase 1

§35.2's "delete audio" has nothing to act on: no audio is captured until the Voice Agent lands
(Phase 2, ADR 0005). The obligation is recorded here and belongs to whichever ADR introduces
audio storage; erasure must grow an R2 object-delete step at that point.

## 3. Consequences

- An erased account cannot log in (`is_active = false`) and cannot refresh
  (`auth.service.ts` already rejects inactive users), so live sessions die within the 15-minute
  access-token TTL without a refresh-token reverse index.
- Erasure is irreversible and unauthenticated-by-nobody-else: it acts only on the caller's own
  `sub` claim. No admin erasure path is specified in Phase 1.
- `users` rows accumulate as anonymised tombstones. This is intended — the alternative
  re-opens the email-uniqueness slot and lets an erased address be silently re-registered as if
  the erasure never happened.
- §52.1's purge list is void. Anyone reading §52.1 in isolation will get the wrong answer;
  this ADR is the correction.
- Erasure and the calibration corpus are now independent by construction, which is what lets
  ADR 0006's pipeline-integrity claim survive contact with real users.
