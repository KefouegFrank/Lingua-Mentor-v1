# Project Structure and Naming Conventions

**Applies to:** the entire `lingumentor/` monorepo
**Status:** living document — update this when the structure changes, don't let it drift
**Last updated:** 2026-07-07

This document explains *why* the repo is laid out the way it is, and the naming
rules to follow when adding anything new. If you're about to create a folder,
rename a file, or aren't sure where something belongs, check here first.

---

## 1. Why a monorepo, and why `apps/` + `packages/`

Everything lives in one repository because the frontend, API gateway, AI
service, and worker are developed by one person and deploy together as one
system — there's no organizational reason to pay the cost of multi-repo
coordination (versioning across repos, cross-repo PRs for a single feature)
that multi-repo setups exist to solve.

The `apps/` vs `packages/` split is the standard convention used by
Turborepo/Nx-style JS monorepos, and it's adopted here even though the repo
is polyglot:

- `apps/` — deployable things. Each folder under `apps/` produces its own
  Docker image and runs as its own process/container.
- `packages/` — shared, non-deployable code consumed by more than one app.
  If only one app uses it, it belongs inside that app, not in `packages/`.

**Important asymmetry:** `packages/` currently only contains TypeScript code
(`shared-types`, `shared-schemas`), because those are the only two apps
written in the same language (frontend, api-gateway). There is no shared
Python package yet between `ai-service` and `worker` — if one becomes
necessary (e.g. shared Pydantic schemas or a shared provider abstraction),
create `packages/shared-py/` as its own Poetry-managed package rather than
importing directly across `apps/ai-service` and `apps/worker`'s folders.

---

## 2. The pnpm workspace only covers the JS/TS side

`pnpm-workspace.yaml` lists `apps/frontend`, `apps/api-gateway`, and
`packages/*` — it deliberately does not (and cannot) include `apps/ai-service`
or `apps/worker`. Those are independent Poetry projects. This means:

- `pnpm install` at the repo root sets up frontend + api-gateway + shared
  packages only.
- Each Python app is installed separately: `cd apps/ai-service && poetry install`.
- There is no single root-level "install everything" command, and adding one
  that shells out to both package managers is more fragile than just
  documenting the two steps — see `scripts/setup-dev.sh`.

---

## 3. Naming conventions by language

### TypeScript / JavaScript (`frontend`, `api-gateway`, `packages/*`)
- **Folders and file names:** kebab-case — `voice-agent/`, `jwt-strategy.ts`.
  Existing exceptions: Next.js reserved file names (`page.tsx`, `layout.tsx`)
  and Next.js route-group syntax (`(auth)`, `(dashboard)`) follow Next.js's
  own conventions, not ours — don't kebab-case inside the parentheses.
- **Variables and functions:** camelCase.
- **Types, interfaces, React components, classes:** PascalCase.
- **Module suffixes inside `api-gateway/src/modules/*`:** `*.routes.ts`
  (route registration), `*.service.ts` (business logic), `*.schema.ts`
  (validation), so you can tell a file's role from its name alone without
  opening it.

### Python (`ai-service`, `worker`)
- **Folders and file names:** snake_case — `writing_evaluation/`,
  `groq_provider.py`. This is a hard PEP 8 convention, not a style
  preference — Python's import system is case-sensitive and idiomatic
  tooling (ruff, mypy) assumes it.
- **Classes:** PascalCase. **Functions and variables:** snake_case.
- **Every package folder needs `__init__.py`,** even if empty — that's what
  makes it an importable package rather than just a directory.

### Cross-cutting
- **Environment variables:** SCREAMING_SNAKE_CASE everywhere, regardless of
  language. When a name could be ambiguous across services (e.g. both
  `api-gateway` and `ai-service` need a Redis URL), it's fine for both to be
  named `REDIS_URL` in their own `.env` — they're separate files — but don't
  invent a project-wide `.env` that tries to serve every service at once.
- **Database tables:** snake_case, plural nouns — `writing_submissions`,
  `exam_sessions`, matching standard SQL convention and what Alembic will
  generate by default from the SQLAlchemy models in `app/db/models/`.
- **Score columns:** always `NUMERIC(4,2)`, no exceptions, per the existing
  project-wide decision. This belongs in every model in `app/db/models/`
  that stores a score, and every raw query in `app/db/repositories/` that
  reads or writes one.

---

## 4. The `models/` vs `repositories/` split in `ai-service` — read this before touching either

This is the one pattern in the repo that looks redundant but isn't:

- **`app/db/models/`** — SQLAlchemy ORM declarative models. These exist
  *only* so Alembic's autogenerate can diff them against the live schema and
  produce migrations. Nothing in the running application queries through
  these at request time.
- **`app/db/repositories/`** — hand-written `asyncpg` queries. This is the
  actual runtime data-access path for every request.

If you add a column, add it to the model in `models/` first (so Alembic
picks it up), then update the corresponding raw query in `repositories/` to
actually use it. Adding it in only one place is the most likely source of a
silent bug in this codebase — the model and the query will disagree about
what the table looks like.

---

## 5. API versioning

Every HTTP route, in both `api-gateway` and `ai-service`, is mounted under
`/api/v1/...`. There's no v1 traffic yet, which makes this the cheapest
possible time to establish the convention — retrofitting a version prefix
onto a live API with real clients is a much worse day than typing `/v1/` now.
`ai-service`'s router folder is literally named `app/api/v1/routers/` to keep
this explicit in the file layout, not just in the URL.

---

## 6. The `voice` module isolation rule

`api-gateway/src/modules/voice/` is intentionally kept self-contained —
its own routes, its own schema, its own gateway file — even before there's
any performance reason to split it into a separate process. The reason is
forward-looking: the deployment architecture (see
`docs/architecture/adr/0001-deployment-architecture-patch-v1.md`, §2.2 and
§6.2) defers a REST/voice-WebSocket process split until real concurrency
data justifies it, but that split only stays a cheap configuration change
*if* voice-handling code was never allowed to leak into shared/general
request-handling paths. Keep it that way from the first commit, not just
once the trigger fires.

---

## 7. Provider abstraction (`ai-service/app/providers/`)

Every external LLM/STT/TTS vendor sits behind a `base.py` interface in its
own subfolder (`providers/llm/`, `providers/stt/`, `providers/tts/`).
Engine code (`app/engines/*`) calls the interface, never a specific vendor's
SDK directly. This is what makes the current dev-stack choices — Groq for
LLM calls, gTTS for synthetic audio — swappable later (ElevenLabs in Phase 2,
or a different LLM vendor if pricing or quality changes) without touching
any of the five engines' logic, only the provider implementation and a
config value.

---

## 8. Exam definitions are config, not code (`ai-service/app/config/exams/`)

Each supported exam (`ielts_academic`, `ielts_general`, `toefl_ibt`,
`delf_b1`, `delf_b2`) is a YAML file, not a Python module. Adding a new exam
or exam variant should mean adding a new YAML file and, if genuinely
necessary, extending the schema that reads it — not writing new branching
logic per exam scattered across the engines. If you find yourself writing
`if exam_id == "toefl_ibt":` inside an engine, that's a signal the config
schema is missing a field it needs, not that the exam needs its own code path.

---

## 9. Documentation and architecture decision records

- `docs/prd/` — the Master PRD. Authoritative for product and architecture
  decisions unless explicitly patched.
- `docs/architecture/adr/` — numbered, sequential (`0001-`, `0002-`, ...),
  each one stating exactly which Master PRD sections it patches and why.
  Never edit a merged ADR to reflect a new decision — write a new one that
  supersedes it and says so explicitly. The numbered sequence is the audit
  trail of how the architecture actually evolved; editing history away
  defeats the purpose.
- `docs/runbooks/` — operational procedures written for how the system is
  actually run right now (solo operator, Phase 1), not aspirational copies
  of Master PRD sections written for a future team. `incident-response.md`
  exists specifically to not just restate Master PRD §57's on-call rotation
  as if a solo operator could run it.

---

## 10. Tests mirror source structure

- `api-gateway/test/` and `ai-service/tests/` / `worker/tests/` should mirror
  the `src/` or `app/` tree they're testing — a test for
  `app/db/repositories/writing_repository.py` lives at
  `tests/db/repositories/test_writing_repository.py`, not in a flat catch-all
  folder. This is what keeps "where's the test for this file" a one-second
  question instead of a search.
- Python test files: `test_*.py` (pytest's default discovery pattern).
- TS/JS test files: `*.test.ts`, colocated or under `test/`, matching
  whichever convention the test runner (vitest) is configured to discover —
  keep it consistent across `frontend` and `api-gateway` rather than letting
  each app drift to a different pattern.

---

## 11. What NOT to add without a reason

- Don't add a top-level folder outside `apps/`, `packages/`, `infra/`,
  `docs/`, `scripts/`, and `.github/` without updating this document to
  explain why the existing categories didn't fit.
- Don't self-host something in `infra/docker-compose.prod.yml` "to save
  money" without checking `docs/architecture/adr/0001-...md` first — the
  self-host-vs-managed call for each piece of infrastructure was made
  deliberately, per-component, not as a blanket default.
