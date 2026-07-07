# Documentation policy

This folder does not hold all of the project's documentation — only the
parts that genuinely belong in a standalone folder. Most documentation lives
next to the code it describes, for one concrete reason: documentation
disconnected from the code it describes always drifts out of sync, because
nobody remembers to update a separate file when they change a function.
What follows is what goes where, and why.

---

## What lives in this folder

### `prd/`
The Master PRD. Authoritative for product intent. Changes rarely, and only
through explicit decisions — if reality diverges from it, patch the specific
section via an ADR rather than editing the PRD itself.

### `architecture/adr/`
A permanent record of decisions, not a living spec. Each ADR (Architecture
Decision Record) captures *context → decision → consequences* at the moment
a decision was made.

**Once an ADR is merged, it is never edited again.** If a later decision
changes course, write a new ADR that says explicitly "supersedes 000X, here's
why" — don't rewrite the old one to look like the new decision was always
the plan. This is what makes an ADR impossible to go stale: it never claims
to describe the current state, only a decision and its reasoning at a point
in time.

Numbered sequentially: `0001-`, `0002-`, and so on. That sequence is the
audit trail of how the architecture actually evolved.

### `architecture/diagrams/`
Only when a picture genuinely beats a paragraph — structural or flow
relationships (a request's path through services and back), not reasoning
or trade-offs. Reasoning belongs in ADR prose. Don't diagram by default.

### `runbooks/`
Procedures meant to be followed under pressure, not read for understanding.
Imperative, step-by-step: run this, check for this output, do this next.

An untested runbook is a guess wearing documentation's clothes. If a runbook
describes a recovery or restore procedure, it needs to have actually been
run once, not just written down as something that should theoretically work.

---

## What does NOT live in this folder

### Per-app `README.md`
Each `apps/*` folder has its own — what this service is, how to run it.
Short, and links out rather than trying to contain everything.

### Docstrings and JSDoc
Live in the file, next to the function they describe. Python: docstrings
under each function/class. TypeScript: `/** */` blocks above the function.
This is what keeps documentation connected to the code — a reviewer sees
immediately if a change makes a docstring wrong, instead of it silently
rotting in a separate file nobody opens.

### API documentation
Generated from the code, not written separately:
- `ai-service` (FastAPI): interactive docs at `/docs` and `/redoc`, built
  automatically from route type hints and Pydantic models. Fill in
  `Field(..., description="...")` on Pydantic fields so the generated docs
  are actually useful, not just present.
- `api-gateway` (Fastify): equivalent via the `@fastify/swagger` plugin.

This category of documentation can't go stale, because it's derived from
the real code at build time rather than written separately and hoped to
stay accurate.

### Inline comments
Explain *why*, not *what*. The code already shows what it does; a comment
repeating that is noise. A comment earns its place when it captures
something the code can't say for itself — why a particular provider was
chosen, why a retry has a specific backoff, why an edge case is handled the
way it is.

---

## The one rule that ties this together

Update documentation in the **same commit** as the code change it describes
— never as a separate "clean up the docs" task, because that task never
actually happens. The only thing exempt from this rule is the ADR log,
which is immutable by design. Everything else — READMEs, docstrings,
runbooks — needs to move in lockstep with the code, or it becomes actively
misleading, which is worse than having no documentation at all.