# LinguaMentor

AI-powered exam-readiness platform (IELTS, TOEFL, DELF) — voice practice, writing
evaluation, adaptive learning, and exam simulation for learners across Africa,
Southeast Asia, and Latin America.

## Repo layout

This is a polyglot monorepo: the frontend and API gateway are TypeScript/Node,
managed as a pnpm workspace; the AI service and background worker are Python,
managed independently. Full rationale for every structural decision is in
[`docs/architecture/project-structure-and-conventions.md`](docs/architecture/project-structure-and-conventions.md) —
read that before adding new top-level folders or renaming anything.

    apps/
      frontend/       Next.js 14 PWA
      api-gateway/     Node.js / Fastify — REST, SSE, voice WebSocket
      ai-service/      Python / FastAPI — the five AI engines
      worker/          Python / BullMQ consumer — background jobs on Redis
    packages/
      shared-types/    TS types shared between frontend and api-gateway
      shared-schemas/  zod schemas shared between frontend and api-gateway
    infra/             docker-compose, Coolify config
    docs/              PRD, architecture decision records, runbooks
    scripts/           one-off operational scripts

## Getting started

1. Copy every `.env.example` in `apps/*` to `.env` and fill in real values.
2. `pnpm install` at the repo root (installs frontend + api-gateway + packages).
3. For ai-service and worker: `cd apps/ai-service && poetry install` (repeat for `worker/`).
4. `docker compose -f infra/docker-compose.yml up` to bring up Redis + all services locally.

## Docs

- Product spec: `docs/prd/`
- Architecture decisions: `docs/architecture/adr/`
- Operational runbooks: `docs/runbooks/`
