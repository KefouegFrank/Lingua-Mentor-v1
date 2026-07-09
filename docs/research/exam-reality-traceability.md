# Exam-reality traceability matrix

**Source:** [`exam-ground-truth-reference.md`](exam-ground-truth-reference.md) (July 2026 review)
**Audit date:** 2026-07-09
**Purpose:** map every finding in the reference to (a) where, if anywhere, it touches the
current codebase, and (b) the decision that resolves it. This is the checklist that
guarantees no finding was silently dropped — if a row says "no action," it says why.

**Status legend:** `ADR` = resolved by a numbered decision record · `deferred` = decision
made to defer, recorded in the cited ADR · `no-code` = affects only frozen PRD prose or
out-of-scope material, resolved by an ADR without a code change · `open` = tracked, not yet
decided.

---

## Critical (🔴)

| # | Finding (short) | Codebase locus | Resolution | Status |
|---|---|---|---|---|
| 1.1 | TOEFL iBT overhauled 2026-01-21; Integrated/Independent Writing + 14–30 range retired | `apps/ai-service/app/config/exams/toefl_ibt.yaml` (retired tasks; wrong 0–9 scale); "TOEFL=3 categories" assumed in `evaluation.py`, `writing_repository.py`, worker `writing_queries.py`, gateway `writing.service.ts`, and 2 tests | [ADR 0003](../architecture/adr/0003-toefl-ibt-2026-redesign.md) — rebuild target documented; config marked non-production; deferred until after IELTS launch | ADR / deferred |
| 1.2 | TCF Canada's real output is NCLC (1–12), not CEFR | No `nclc` field anywhere; `LearnerProfile` (`identity.py:88-91`) has CEFR only | [ADR 0004](../architecture/adr/0004-readiness-prediction-exam-dependent-output.md) — NCLC output layer specified (separate versioned conversion table); deferred to when TCF/TEF land | ADR / deferred |
| 1.3 | TEF Canada missing from scope entirely (separate body, own NCLC table) | No `tcf_canada.yaml`/`tef_canada.yaml`; zero repo hits | [ADR 0004](../architecture/adr/0004-readiness-prediction-exam-dependent-output.md) — recorded as distinct exam needing its own config + conversion table; deferred (Phase 2+) | ADR / deferred |
| 1.4 | ≥0.85 Pearson is ambitious, not routine (prior art both ways) | `apps/ai-service/app/calibration/harness.py` gates at 0.85/0.80 | [ADR 0006](../architecture/adr/0006-phase-0-calibration-gate-hardening.md) — reaffirms PRD Risk Register; interim-gate + iteration-budget guidance | ADR |
| 1.5 | No adversarial/gaming-resistance testing in the Go/No-Go gate | `harness.py` (Pearson only); `tests/calibration/` (no gamed samples); zero repo hits for adversarial/gaming | [ADR 0006](../architecture/adr/0006-phase-0-calibration-gate-hardening.md) — adds adversarial set as a **hard gate** | ADR |
| 1.6 | DELF/DALF scoring is 4-tier ordinal (0/1/3/5) since Sept 2022, not continuous weights | `delf_b1.yaml`/`delf_b2.yaml` (0–9 scale, 0.25 weights); `schemas.py:27` (continuous only); `engine.py:52` (uniform weighted mean); `prompt_builder.py:37` (continuous instruction) | [ADR 0002](../architecture/adr/0002-writing-evaluation-scoring-models.md) — `scoring_model: ordinal_tiered` for DELF/DALF; native scoring + calibration | ADR |

## High (🟠)

| # | Finding (short) | Codebase locus | Resolution | Status |
|---|---|---|---|---|
| 1.7 | Accent-neutrality is official policy everywhere; conflicts with accent-relative design | Only PRD prose (§4.4/§7.2/§20.4/§26); `accent_target` DB field exists, no engine logic yet | [ADR 0005](../architecture/adr/0005-accent-relative-scoring-engineering-choice.md) — reframed as engineering choice, not exam replication | ADR / no-code |
| 1.8 | One Readiness output shape can't fit all exams (band vs. floor-pass vs. per-skill NCLC) | `ReadinessSnapshot` (`analytics.py:32-39`) single band+CI; `ExamAttempt.readiness_at_attempt` scalar; engine is a stub | [ADR 0004](../architecture/adr/0004-readiness-prediction-exam-dependent-output.md) — Models A/B/C; ship A, add B/C additively | ADR / deferred |
| 1.9 | IELTS is single-marker + "jagged profile" flagging, not universal double-marking | Calibration Brief §3.2 assumes ≥2 examiners universally | [ADR 0006](../architecture/adr/0006-phase-0-calibration-gate-hardening.md) — records the per-exam distinction; notes it validates our Score Appeal Flow | ADR |
| 1.10 | Timing granularity is per-task, not just per-section, for several exams | Exam Simulation engine is a stub (no timer logic yet) | [ADR 0003](../architecture/adr/0003-toefl-ibt-2026-redesign.md) (TOEFL 7-min email) + noted for Exam-Sim build | ADR / open |
| 1.11 | Retake policies differ (IELTS One-Skill vs. full-retake elsewhere) | Not modeled anywhere yet | no-code — product-messaging note in [ADR 0003](../architecture/adr/0003-toefl-ibt-2026-redesign.md) / traceability; revisit at Exam-Sim build | open |
| 1.12 | Register/sociolinguistic is a distinct criterion in DELF/TCF; no schema slot | `schemas.py:46` caps categories at 4; `WritingScoreBreakdown` has 4 fixed slots | [ADR 0002](../architecture/adr/0002-writing-evaluation-scoring-models.md) — register becomes first-class; 4-criterion cap lifted (additive `category_5_*`) | ADR |
| 1.13 | Adaptive difficulty is now common (TOEFL R/L, TCF MCQ); Exam-Sim is fixed-form | Exam Simulation engine is a stub | no-code — conscious deferral noted in [ADR 0003](../architecture/adr/0003-toefl-ibt-2026-redesign.md); Phase-1 stays fixed-form | deferred |

## Medium (🟡)

| # | Finding (short) | Resolution | Status |
|---|---|---|---|
| 1.14 | Unvalidated AI-scoring competitors already exist per exam | no-code — market context; noted in reference | no-code |
| 1.15 | Score-integrity failures come from pipeline bugs too (Ofqual £875k) | [ADR 0006](../architecture/adr/0006-phase-0-calibration-gate-hardening.md) — adds data-pipeline-integrity to Go/No-Go | ADR |
| 1.16 | "CIEP-accredited" is outdated → FEI *habilitation*, 5-yr cycle | [ADR 0006](../architecture/adr/0006-phase-0-calibration-gate-hardening.md) — terminology correction | ADR |
| 1.17 | "TCF Canada" ≠ TCF Québec ≠ TCF Tout Public | [ADR 0006](../architecture/adr/0006-phase-0-calibration-gate-hardening.md) — scope pinned to TCF Canada explicitly | ADR |
| 1.18 | Validity periods differ (DELF/DALF lifetime; others 2 yr) | no-code — product-messaging note; revisit at Exam-Track build | open |
| 1.19 | IELTS test-to-test "equating" — precedent for our drift monitoring | no-code — validates PRD quarterly-recalibration; noted in reference | no-code |

## Low (🟢)

| # | Finding (short) | Resolution | Status |
|---|---|---|---|
| 1.20 | DELF/DALF comprehension now 100% MCQ; DALF C1 tracks merged (2020) | no-code — affects Listening/Reading (Phase 2/3); noted for those builds | deferred |
| 1.21 | 2025–26 IELTS procedural changes (black pen; templated-essay penalty caps TR at 4.0) | no-code — templated-response penalty flagged for the IELTS rubric-injection prompt at calibration time | open |

---

## Coverage check

All 21 findings are accounted for: **11** resolved directly by ADRs 0002–0006, **6** recorded
as deliberate deferrals in an ADR, **4** carried as `open`/`no-code` items tied to engines not
yet built (Exam Simulation, Listening/Reading, Exam Track messaging). No finding is dropped
without a stated reason.

New exam-scope items surfaced but not yet in any config: **TEF Canada** (1.3), **DALF C1/C2**
(reference §2.4), **TCF Québec / Tout Public** (1.17) — all deferred, all recorded here so they
resurface when French-immigration or advanced-French scope is picked up.
