# LinguaMentor — Deployment Architecture Patch v1

**Document type:** Engineering specification / architecture decision record
**Patches:** Master PRD §48–§56 (Deployment Architecture, Containerisation and Kubernetes Strategy, Scaling Strategy, Cost Architecture, Backup and Disaster Recovery)
**Phase:** Phase 1 — pre-launch, zero production users
**Status:** Draft, pending implementation
**Last updated:** 2026-07-07

---

## 1. Scope and Rationale

Master PRD §48–§51 specify a Kubernetes-based deployment target — EKS/GKE/AKS, Helm charts, ArgoCD GitOps, Terraform-managed infrastructure, HPA-based autoscaling — sized for 1,000 concurrent users, of which 200 are concurrent voice sessions per §50.1. Master PRD §55.2 sizes the supporting infrastructure at three t3.xlarge-class worker nodes, a Multi-AZ managed Postgres pair, a three-node managed Redis cluster, and cross-region object storage replication. Master PRD §53 specifies a Prometheus/Grafana/Loki/Jaeger/PagerDuty observability stack.

That target architecture is the right design for a funded team operating at real scale. It is not the right Phase 1 build for a solo developer with zero production users and an infrastructure budget in the $10–50/month range. This patch replaces §48–§56 for Phase 1 only. It does not change product scope, feature set, or AI orchestration architecture defined elsewhere in the Master PRD — those stand as written.

Three engineering decisions anchor this patch:

1. Compute sized to actual Phase 1 concurrency, not the Master PRD's projected 1,000-user target.
2. The primary datastore externalized to a managed provider rather than self-hosted, for failure-domain and backup-ownership reasons.
3. The cache/session store self-hosted, since the reasoning behind decision 2 doesn't apply to it in the same way.

Each is detailed below, along with the specific Master PRD subsection it replaces and why.

---

## 2. Compute Layer

### 2.1 Instance selection
*(Replaces the EKS/GKE/AKS worker-node sizing in Master PRD §48.1 and §55.2 for Phase 1)*

Host: Hetzner CX-series (shared vCPU), starting at 4 vCPU / 8GB.

Not selected: a dedicated-vCPU tier (e.g. Hetzner's CCX line). Dedicated cores exist to guarantee performance isolation under sustained multi-tenant contention. At Phase 1 traffic — zero to low tens of concurrent users — there is no contention to isolate against yet, so that guarantee has no engineering value until real load produces it (see §6.1).

This is also, currently, the financially sensible choice, not only the architecturally correct one: Hetzner's dedicated-vCPU (CCX) line was repriced 2.1–2.7x on 2026-06-15, while the shared-vCPU (CX) line rose only about 30% over the same period. Shared vCPU is the right starting tier on engineering grounds independent of that pricing shift, but the shift removes any temptation to default to "dedicated, just in case."

### 2.2 Process model
*(Replaces the HPA-based multi-replica scaling model in Master PRD §50 for Phase 1)*

Single Node.js process at launch. A cluster-mode split into separate REST/SSE and voice-WebSocket process pools is deferred until the trigger in §6.2 fires.

**Action item, applies from the start of implementation regardless of the deferral:** voice-session handling logic should live in its own module/entry point, not mixed into general request handling. This makes the eventual process split a configuration and process-launch change later, rather than a refactor.

### 2.3 Deployment tooling
*(Replaces the Helm / ArgoCD / Terraform pipeline in Master PRD §48.1 and §54 for Phase 1)*

Coolify or Dokploy: git-push deploys, automatic TLS via Let's Encrypt, reverse proxy configuration. This replaces a GitOps toolchain designed for multi-service Kubernetes clusters with a workflow suited to a single deployable container on a single host — the operational overhead difference between the two is substantial and unjustified at this phase.

---

## 3. Data Layer

### 3.1 Primary datastore: PostgreSQL, externalized (Neon)
*(Replaces the Multi-AZ managed Postgres pair in Master PRD §55.2 for Phase 1)*

**Context:** Master PRD §55.2 specifies a Multi-AZ Postgres pair (two db.r6g.large-class instances) with automated failover, sized for enterprise-scale reliability. Replicating that exact topology isn't warranted with a single application host and no production traffic. But the common lean-launch instinct — self-hosting Postgres as a container next to the application to avoid a second infrastructure bill — introduces failure-domain coupling and backup-ownership burdens that a lightweight managed alternative avoids entirely, for a comparable or lower cost.

**Decision:** Use a managed serverless Postgres provider (Neon).

**Rationale:**

- **Failure-domain coupling.** Co-locating the primary datastore with the application process means a single host failure takes down compute and the system of record at the same moment, with no independent recovery path for either. Externalizing the database removes this coupling entirely, at no infrastructure cost — the datastore's failure domain becomes independent of the app VPS's.

- **Backup ownership.** Self-hosting shifts WAL archiving, restore-runbook authorship, and periodic restore validation onto the operator. This is real, recurring engineering work with a correctness bar that's easy to get wrong the first few times — an untested restore path is not a working restore path. A managed provider with continuous point-in-time recovery removes this work item from the Phase 1 build list rather than deferring it.

- **Connection handling at scale.** The Master PRD's Phase 1 target of 200 concurrent voice sessions implies several hundred concurrent upstream connections at peak (each session touching Postgres for session/profile state in addition to Redis). Self-hosting this requires hand-tuning `ulimit`, Postgres `max_connections`, and likely introducing PgBouncer separately. Neon's connection pooler (PgBouncer-based, supporting up to 10,000 pooled connections) absorbs this without additional configuration.

- **What this does *not* solve:** externalizing Postgres does not remove the need for app-VPS-level `ulimit`/file-descriptor tuning — that's about the app process's own socket handling for voice WebSocket connections and upstream ASR/TTS/LLM calls, which is unrelated to where Postgres lives. That tuning is still required once real voice concurrency exists (see §6.2).

**Configuration at launch:**

- Free tier: 100 compute-hours/month, 0.5GB storage, autoscale up to 2 compute units (1 CU = 1 vCPU + 4GB RAM), compute scales to zero after ~5 minutes of inactivity.
- Region selection: choose the Neon region physically closest to the app VPS's datacenter. Cross-region DB round trips will erode the API Gateway's <300ms non-AI-route latency budget and the Voice Agent's <2.5s full-round-trip budget faster than any other single factor in this stack — this is a one-time configuration decision with an ongoing latency cost if gotten wrong.
- Upgrade path: Neon's Launch plan (usage-based, no monthly minimum in current pricing) once free-tier compute-hours or storage are exceeded. No connection-string or schema changes required — this is a plan change, not a migration.

### 3.2 Cold-start latency: explicit interaction with the voice pipeline

Free and low-tier Neon compute scales to zero after idle. The next query after a cold period incurs an approximate 350ms cold-start penalty before the compute instance is warm.

Against the Master PRD's latency budgets:

- API Gateway (non-AI routes), <300ms target: a 350ms cold start would itself blow this budget on the first request after any idle period. In practice this only matters for routes that hit the DB directly on a cold path with no caching — most non-AI routes should already be served from Redis-cached state per the Master PRD's caching strategy, so this is a secondary concern, not a primary one.
- Voice Agent full round-trip, <2.5s target: 350ms is a meaningful fraction of this budget if a DB read/write sits on the hot path of a voice turn (e.g., persona config or session-state lookups that aren't already cached in Redis). This is the case worth actually instrumenting.

**Action item:** once any real voice traffic exists (including manual testing sessions), log DB query latency on the voice-turn hot path and check for correlation with idle-then-cold-start patterns. If cold starts are measurably eroding the round-trip budget, the fix is disabling scale-to-zero on the Neon project (a small always-on compute floor, still billed per-CU-hour, not a return to self-hosting) — not reverting §3.1.

### 3.3 Cache / session store: Redis, self-hosted
*(Replaces the three-node managed Redis cluster in Master PRD §55.2 for Phase 1)*

**Context:** Master PRD §55.2 specifies a three-node managed Redis cluster (cache.r6g.medium-class) for highly-available cache access. At Phase 1 traffic, a single self-hosted Redis container on the app VPS is sufficient.

**Why this is not treated the same as Postgres:** the failure-domain and backup-ownership argument in §3.1 rests on Postgres being the system of record for data that cannot be reconstructed if lost. Redis in this architecture holds cache, rate-limit counters, and voice session/dialogue state — all either reconstructable from Postgres or acceptable to lose in a worst case (a mid-conversation voice session resetting is a bad user experience, not a data-loss incident). The cost/risk calculus that favors externalizing Postgres does not apply here with the same weight, so self-hosting is the right call.

Persistence configuration: RDB snapshot + AOF (append-only file), written to local disk on the app VPS. No cross-region replication at this phase — see §6 for the trigger that would revisit this.

---

## 4. Object Storage, CDN, Observability, CI/CD

### 4.1 Object storage
*(Replaces the cross-region S3 replication scheme in Master PRD §55.2 for Phase 1)*

Cloudflare R2 for audio blobs, 90-day lifecycle expiry. Still durable, at a fraction of the operational and cost overhead of a cross-region replicated bucket.

### 4.2 CDN / WAF
Cloudflare, free tier — unchanged in intent from the Master PRD's edge strategy.

### 4.3 Observability
*(Replaces the Prometheus/Grafana/Loki/Jaeger/PagerDuty stack in Master PRD §53 for Phase 1)*

Sentry (free tier) plus an external uptime monitor. The full stack in §53 requires dedicated ops time to run and tune that isn't available or justified with zero production traffic.

Node.js event-loop-lag instrumentation on the voice-handling module is written now (a few lines of code) but only wired into active alerting once the process split in §6.2 is implemented — before that point, lag on that metric and lag on the whole single-process app are the same signal, so there's nothing to differentiate yet.

### 4.4 CI/CD
*(Replaces the ArgoCD / Helm / Terraform pipeline in Master PRD §54 for Phase 1)*

GitHub Actions → Docker build → Coolify/Dokploy webhook.

---

## 5. Deployment Topology
*(Replaces Master PRD §50.2 for Phase 1)*

Single VPS runs, as separate containers:

1. API Gateway — Node.js/Fastify, single process (§2.2).
2. `ai-service/` — Python/FastAPI, async, unchanged from the Master PRD.
3. `worker/` — BullMQ consumer, unchanged.
4. Redis — self-hosted, per §3.3.

PostgreSQL is external (Neon), reached from the API Gateway and worker containers over an encrypted connection. Cloudflare terminates TLS at the edge and proxies to the single process pool on the host; no dedicated voice-WebSocket ingress class is needed yet, since there's no separate voice process pool to route to (§2.2).

---

## 6. Scaling Triggers
*(Replaces Master PRD §50.3 for Phase 1, with two additions specific to this architecture)*

Each trigger below maps to a specific engineering action, not a general "add more resources" response.

### 6.1 Sustained CPU utilization above ~70% on the app VPS during real traffic
Action: vertically scale within the Hetzner CX line before considering a move to a dedicated-vCPU tier. Re-evaluate dedicated-vCPU pricing at the time this trigger fires, not against the figures in this document — pricing in this space has changed twice in 2026 already and may change again.

### 6.2 Node.js event-loop lag sustained above ~100ms during voice traffic
Action: implement the cluster-mode REST/SSE vs. voice-WebSocket process split (§2.2, §5). Since voice-handling logic has been isolated in its own module from the start, this should be a process-launch and reverse-proxy configuration change, not a rewrite. Wire the event-loop-lag metric into Sentry/uptime alerting at this point.

### 6.3 Neon free-tier compute-hours or storage approaching their limits
Action: move to Neon's Launch plan. No schema or connection-string change required.

### 6.4 DB cold-start latency measurably degrading the voice round-trip budget (§3.2)
Action: disable scale-to-zero on the Neon project (small always-on compute floor). Do not revert to self-hosted Postgres on the basis of this trigger alone — the failure-domain and backup-ownership reasoning in §3.1 is independent of this latency concern.

### 6.5 Sustained HTTP 429 rejections from ASR/TTS/LLM providers during non-spike traffic
Action: request a concurrency/rate-limit increase from the provider. This is typically faster and cheaper than any infrastructure change, and should be attempted before scaling compute in response to what might actually be an upstream ceiling.

### 6.6 Concurrent voice sessions regularly exceeding roughly 100–150 on a single instance, despite the process split from §6.2
Action: re-evaluate shared vs. dedicated vCPU (§2.1) and Neon's Launch vs. Scale tier against current pricing, and size the app-level `ulimit`/connection-pool configuration explicitly for the concurrency level actually being observed, rather than the Master PRD's 200-session target as a theoretical ceiling.

### 6.7 Real paying users, or a committed uptime expectation to any user
Action: revisit the High-Availability decision in §7. Nothing before this trigger should motivate a move to two-node HA.

---

## 7. High-Availability Decision
*(Replaces Master PRD §56's Multi-AZ/warm-standby posture for Phase 1)*

**Context:** Master PRD §56 envisions Multi-AZ replication and a warm-standby deployment in a secondary region.

**Decision:** Two-node HA is out of scope for Phase 1. The trigger for revisiting this — real users who'd be harmed by an outage, or sustained utilization above 70% — is stated in §6.7.

One point worth noting: the database-level single-point-of-failure risk is smaller here than a fully self-hosted single Postgres instance would carry. Neon's storage layer is durably replicated by default, including on lower-tier plans, even though sub-Scale-plan tiers don't offer a user-controlled standby/failover target. This is a materially better starting position than co-locating Postgres on the app VPS, even though full HA (compute + DB failover) remains out of scope until §6.7 fires.

---

## 8. Backup and Disaster Recovery
*(Replaces Master PRD §56 for Phase 1)*

### 8.1 PostgreSQL
Handled by Neon's continuous backup and point-in-time recovery mechanism. No operator-managed WAL archiving or `pg_dump` cron job is required, which removes an entire runbook from the Phase 1 operational surface.

**Action item before launch:** verify the restore path at least once using Neon's branch-based instant-restore feature, rather than assuming the documented mechanism works as described. An untested restore path is not a working restore path, regardless of which provider owns it.

### 8.2 Redis
RDB snapshot + AOF persistence to local disk on the app VPS, per §3.3 — this data is reconstructable or short-lived by design, so no cross-region replication is warranted at this phase.

### 8.3 Application
Redeploy from git + Docker image to a fresh VPS if the host is lost. RTO target: under 1 hour.

### 8.4 Object storage
Cloudflare R2's built-in multi-datacenter redundancy (§4.1).

---

## 9. Out of Scope for This Patch

Unaffected by this document: product scope and feature set, the five AI engine architectures (Voice Agent, Writing Evaluation, Exam Simulation, Adaptive Learning, Readiness Prediction), AI provider routing and model selection, prompt architecture, business model, and all Master PRD sections not listed in the patch scope above. This is an infrastructure-layer document only.
