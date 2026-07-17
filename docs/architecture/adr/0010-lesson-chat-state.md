# LinguaMentor — Lesson Chat State and the SSE Turn Endpoint

**Document type:** Architecture decision record
**Patches:** Master PRD §29 (ERD — adds `lesson_sessions`, `lesson_messages`), §35.3 (adds the turn endpoint)
**Phase:** Phase 1 — Core Platform (§61, "Streaming SSE for chat AI responses")
**Status:** Accepted
**Last updated:** 2026-07-17

---

## 1. Context

§61 requires "Streaming SSE for chat AI responses — first token < 500ms", and §59 requires "Text AI
Mentor Chat — lesson chat with grammar correction, inline feedback, persona tone applied". The
streaming transport now exists (provider `stream()`, ADR-less, §19.5). The chat it streams does not,
and cannot, because the PRD specifies a chat with nowhere to keep its state:

- **The ERD (§29) has no lesson, chat or message table.** The schema's fourteen tables cover
  writing, speaking, exams, SRS, readiness and identity. Yet §35.3 specifies
  `POST /api/v1/session/lesson` ("Start a new lesson session. Returns lesson content and session
  ID"), `POST /api/v1/session/lesson/:id/complete` ("Mark lesson session complete. Triggers skill
  vector update") and `GET /api/v1/session/history` ("Paginated list of all sessions").
- **§33's Redis architecture has no conversation key.** It defines `session:{session_id}` (voice
  dialogue state), `persona:{session_id}` and `lesson_cache:{hash}` (generated content by prompt
  hash) — nothing holding §19.4 Layer 7's "conversation history (bounded last N turns)".
- **§35.3 has no endpoint for a chat turn.** It can start a lesson and complete one, but never send
  a message. §36's `POST /mentor/evaluate-response` is the internal counterpart with no
  client-facing route above it.

## 2. Decision

### 2.1 Lesson state is durable: `lesson_sessions` and `lesson_messages`

Two tables are added to the §29 ERD.

`lesson_sessions` — one row per lesson: learner, topic, the skill it targets, `started_at`,
`completed_at`. This is what `GET /session/history` paginates and what `/complete` marks.

`lesson_messages` — one row per turn: session, `role` (`learner` | `mentor`), `content`,
`created_at`, and a nullable `ai_model_run_id` on mentor turns. This is Layer 7's history.

The alternatives were considered and rejected:

- **Redis-only** (a new `chat:{session_id}` key beside its §33 neighbours) is cheap and matches how
  `session:`/`persona:` already work, but it cannot answer `GET /session/history`, and a lesson that
  evaporates on a 2h TTL cannot feed the skill-vector update `/complete` is specified to trigger.
  Two of §35.3's three lesson endpoints would be undeliverable by construction.
- **Client-sends-history** stores nothing, and hands the learner authorship of the assistant's prior
  turns. That is the placement `prompt_text` hole in a new costume: a forged mentor turn ("you have
  reached C2") is content the model treats as its own. Rejected on the same grounds.

This adds schema the PRD's own ERD never drew, which is why it is recorded here rather than assumed.

### 2.2 A chat turn is `POST /api/v1/session/lesson/:id/message`, streaming SSE

§35.3 specifies no way to say anything in a lesson. The turn endpoint is added under the resource
§35.3 already owns.

It is a `POST` and not an `EventSource` `GET`: the browser's `EventSource` cannot set an
`Authorization` header, and the workarounds — a token in the query string, which lands in access
logs and proxy caches — trade the §37 auth model for API tidiness. The client reads the stream with
`fetch` + `ReadableStream`, which carries the bearer header like every other call.

The gateway proxies ai-service's stream rather than re-terminating it, so back-pressure and flush
timing survive the hop and §51's first-token target measures the thing the learner actually waits on.

### 2.3 History is server-read and bounded to the last 10 turns

Layer 7 is assembled from `lesson_messages` on each turn, never from the request body. Ten turns is
the bound: §55 caps monthly per-user AI cost at 40% of a Pro subscription, and an unbounded
transcript makes every turn more expensive than the last — the one shape of chat cost that grows
without a ceiling.

### 2.4 The learner's message is persisted before the model sees it

A turn writes the learner's message, streams the reply, then writes the mentor's. A stream that dies
mid-flight therefore leaves the learner's turn recorded and no phantom mentor reply — the next turn
resumes from a truthful transcript. The AIModelRun row is written when the stream completes, carrying
`streaming_first_token_ms`, which §61 names and nothing has ever produced.

## 3. Consequences

- `GET /session/history` and `/lesson/:id/complete` become buildable. Neither is in §61's Phase 1
  list, so they are not built here; this ADR only stops them being impossible.
- A dropped stream costs the mentor's reply, not the learner's message. §19.5's fallback ("client
  requests full synchronous response") is not implemented — the client may simply re-send the turn.
- `lesson_messages` holds learner-authored free text, so GDPR erasure (ADR 0007 §2.4) must clear it.
  Erasure is updated in the same change; a table added after that ADR that quietly retains prose
  would make its "retains only aggregated anonymized metrics" claim false.
- Chat is not gated by Phase 0 calibration. Correct: a conversation asserts no band and no CEFR
  level, and the §19.4 policy layer forbids it from doing so. The gate protects scores, not talk.
