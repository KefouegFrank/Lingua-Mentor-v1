# LinguaMentor — Readiness Prediction Output Is Exam-Dependent

**Document type:** Architecture decision record
**Patches:** Master PRD §25 (Readiness Prediction Engine); introduces the NCLC Output Layer requirement (review §5.2)
**Phase:** Phase 1 decision; implementation spans Phase 1 (Model A) and Phase 2+/Phase 4 (Models B/C, NCLC)
**Status:** Accepted; Model A in scope, Models B/C deferred (see §2.3)
**Last updated:** 2026-07-09

---

## 1. Context

Master PRD §25.1 defines one readiness output: `Readiness Index = weighted_skill_average ×
trend_factor × stability_factor`, yielding a `Projected Band ± Confidence Interval`. The data
layer already commits to that single shape: `ReadinessSnapshot`
(`apps/ai-service/app/db/models/analytics.py`) has one `projected_band_score`, one
`confidence_interval_low/high` pair, and `trend_factor`/`volatility_factor` scalars;
`ExamAttempt.readiness_at_attempt` is a single scalar. The Readiness engine itself is still an
empty stub — no logic has been written.

The exam-reality review ([`exam-ground-truth-reference.md`](../../research/exam-ground-truth-reference.md),
finding 1.8, and 1.2/1.3) establishes that a single "band + confidence interval" fits only two of
the exam families in scope:

- **IELTS / TOEFL** — a simple average of section bands, no per-section floor. Band + CI is correct.
- **DELF / DALF** — pass/fail with a **hard per-skill floor**: any skill below 5/25 fails the whole
  exam regardless of the /100 total. The useful prediction is **P(pass)** under that floor
  constraint, driven by the *weakest* skill — not a symmetric band with a CI. DALF C2 doesn't even
  separate comprehension from production, so its floor logic is per-paper, not per-skill.
- **TCF / TEF Canada** — **per-skill NCLC (1–12), no combined overall score at all**; IRCC evaluates
  each skill independently and NCLC (not CEFR) is the unit the learner actually submits. NCLC is a
  distinct scale from a different governing body, with its own official conversion table — and TCF
  Canada and TEF Canada use *separate* tables (different administering bodies), so scores are not
  interchangeable across the two.

Because the engine has no logic yet, this is the cheapest possible moment to decide its shape —
before a Model-A-only readiness engine gets written and hardcoded on top of a schema that can't
express the other two.

## 2. Decision

Readiness output is a function of the exam's scoring shape. Define three models; the engine
selects one from `exam_type` at Exam-Track setup, and the selection drives both the computation
path and the downstream dashboard/report component.

- **Model A — Banded Average + CI (IELTS, TOEFL).** The existing §25.1 design. Weighted skill
  aggregation, trend factor, projected band with confidence interval, daily delta. No floor.
- **Model B — Floor-Constrained Pass Probability (DELF, DALF).** Report **P(pass)** — the joint
  probability that the /100 total clears 50 **and** every skill clears its 5/25 floor — computed
  from per-skill score distributions (e.g. Monte Carlo over each skill), with the **weakest skill's
  floor-clearance probability** surfaced as the primary risk driver. For DALF C2, apply the floor
  at the paper level (écrite, orale), not as four independent skills. This is the readiness-level
  home of the DELF cross-skill floor that [ADR 0002](0002-writing-evaluation-scoring-models.md)
  deliberately left out of the per-essay writing score.
- **Model C — Per-Skill NCLC Projection (TCF Canada, TEF Canada).** No aggregate "overall."
  Project each skill's NCLC (1–12) with its own confidence interval; organize the dashboard around
  progress toward a target NCLC per skill (commonly NCLC 7 for economic immigration).

### 2.1 The NCLC Output Layer (review §5.2)

Model C consumes an NCLC output layer that Phase 1's CEFR-only data model does not have:

- `nclc_conversion_version` — a versioned, immutable reference to the specific official conversion
  table in use, analogous to `calibration_version`. **TCF Canada and TEF Canada require separate
  tables** — one shared table across both is a correctness bug, not a simplification.
- `nclc_per_skill` — one integer (1–12) per skill, computed via the correct exam-specific table
  from that exam's own raw scale, stored **alongside** (never instead of) CEFR.
- CEFR remains the only scale for IELTS, TOEFL, DELF, and DALF.

### 2.2 Phase 1 implementation scope: Model A only

Ship **Model A only** now. `ReadinessSnapshot` keeps its current columns; Models B and C add their
fields **additively** (nullable `pass_probability` / `weakest_skill_floor_clearance` for B; an NCLC
projection structure for C, likely a JSONB column or a dedicated table) when those exams and the
Readiness engine are actually built. Additive-only migrations, consistent with PRD §28.2.

### 2.3 Deferral, tied to exam scope

Models B and C do not become implementable until their exams are in scope. DELF readiness (Model B)
lands when the Readiness engine is built (PRD §61 sequences that in Phase 4) and DELF is being
predicted, not just scored. Models C + the NCLC layer land when **TCF Canada** (PRD roadmap: Phase 2,
after fr-CA accent calibration) and **TEF Canada** (not currently in the PRD at all —
see [the traceability matrix](../../research/exam-reality-traceability.md), finding 1.3) enter
scope. This ADR exists precisely so that deferral is a recorded decision with a schema-evolution
path, not an omission someone has to rediscover.

## 3. Consequences

- The Readiness engine, when built, must read `exam_type` and branch — it cannot assume Model A.
  This ADR is the standing instruction that prevents a hardcoded single-model engine.
- `ReadinessSnapshot` stays as-is for Model A; a later additive migration extends it for B/C. No
  Phase 1 rework, no rewrite.
- The 4D CEFR profile (PRD §22) is unaffected for IELTS/TOEFL/DELF; TCF/TEF additionally carry NCLC
  when they land, and their learner-facing dashboards lead with NCLC (with the NCLC-7 threshold
  marked), CEFR secondary.
- TEF Canada is now on record as a first-class future exam with its own config and conversion table
  — closing the scope gap in finding 1.3.
- **Not solved here:** the actual NCLC conversion tables (TCF and TEF each) and the DELF per-skill
  score distributions that Model B's Monte Carlo needs are data-acquisition tasks, out of scope
  until their exams are picked up.
