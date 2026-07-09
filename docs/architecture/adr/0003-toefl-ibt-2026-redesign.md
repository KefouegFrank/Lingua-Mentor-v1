# LinguaMentor — TOEFL iBT 2026 Redesign

**Document type:** Architecture decision record
**Patches:** Master PRD §7.1 (Phase 1 Language Scope — TOEFL), §8.2 (Supported Exams — TOEFL row); cross-references Phase 0 Calibration Brief §2.1
**Phase:** Phase 1 — pre-launch
**Status:** Accepted; corrected format deferred (see §2.3)
**Last updated:** 2026-07-09

---

## 1. Context

`apps/ai-service/app/config/exams/toefl_ibt.yaml` models TOEFL Writing as an "Independent
Writing (essay)" task scored on three categories — Development, Organization, Language Use — on
the unified 0.0–9.0 band scale. The Phase 0 Calibration Brief §2.1 specifies TOEFL sample
collection as "Integrated + Independent Writing," score range 14–30.

Both are wrong as of the exam's own timeline. The exam-reality review
([`exam-ground-truth-reference.md`](../../research/exam-ground-truth-reference.md), finding 1.1)
documents that **ETS overhauled TOEFL iBT on 2026-01-21** — weeks before the Master PRD's own
"Updated: 2026-02-23" date. The two-task Writing section (Integrated + Independent essay) was
**retired** and replaced by three new tasks:

- **Build a Sentence** — binary correct/incorrect (grammatical accuracy *and* semantic appropriateness).
- **Write an Email** — 0–5 across four dimensions (task completion, tone/register, organization, language use), with a hard 7-minute window.
- **Writing for an Academic Discussion** — 0–5 across four dimensions (position clarity, engagement with a classmate's post, reasoning quality, language control).

Reporting also changed: a new **1.0–6.0 CEFR-aligned primary scale** (Band 5 ≈ C1), with the
legacy 0–120 retained only as a companion figure during a 2026–2028 dual-reporting transition.
Independent Speaking was removed from the Speaking section in the same update, and
Reading/Listening became multistage-adaptive.

The current config is therefore a **double miss**: it matches neither the retired format's
14–30 range nor the new 1.0–6.0 scale, and its single 3-category rubric matches none of the
three new tasks (each of which is a distinct scoring construct). Any TOEFL samples collected
against the old tasks would calibrate against a test ETS no longer administers (finding 1.1).

## 2. Decision

### 2.1 The retired format is removed from production scope

The Integrated/Independent Writing model is not a valid target. No Phase 0 samples are to be
collected against it. The existing `toefl_ibt.yaml` is **marked non-production**: not
calibration-eligible and not user-facing, so the retired exam cannot ship while the corrected
format is pending. (Mechanism: a config flag such as `status: non_production` that the exam
loader and the calibration harness both honour — the exact flag name is an implementation
detail for the executing slice.)

### 2.2 The corrected target is recorded now

The rebuild target is the current three-task format above, scored on the native **1.0–6.0
CEFR-aligned band** (with 0–120 as a display companion through the transition). Because the
three tasks have genuinely distinct constructs, they are modeled as **three exam-config entries
grouped under a `toefl_ibt` exam family** (e.g. `toefl_email`, `toefl_academic_discussion`,
`toefl_build_sentence`) rather than one config with a single shared rubric — the engine already
evaluates one rubric per submission, so three task types are three submission types. Write an
Email and Academic Discussion are 0–5 four-dimension rubrics (`banded_continuous` per
[ADR 0002](0002-writing-evaluation-scoring-models.md), on the 1.0–6.0 scale). **Build a Sentence
is binary** and likely does not belong on the LLM rubric-scoring path at all — it is a
deterministic grammar+semantics check; it may sit outside the writing-eval engine or be scored
by a distinct path. That routing decision is deferred with the rest of the rebuild.

### 2.3 Rebuild is deferred until after IELTS launch

**IELTS Academic is the anchor exam** for Phase 0 and first launch: the largest market, the
clearest published rubric, and already correct in the codebase. TOEFL's three-task rebuild —
new configs, the per-task rubric shapes, the 1.0–6.0 scale, the Build-a-Sentence routing
question — is real work with no Phase-0-blocking urgency once the retired config is prevented
from shipping. It is therefore **deferred to after IELTS is calibrated and launched**, and
recorded here so it resurfaces deliberately rather than by accident.

### 2.4 Open item carried forward

Confirm with ETS whether e-rater/SpeechRater (the closest real-world prior art, review §2.2)
have been adapted to the three new task types — the review's automated-scoring evidence is
drawn primarily from the retired tasks. This informs, but does not block, our own design.

## 3. Consequences

- `toefl_ibt.yaml` is quarantined (non-production) until the rebuild; no user sees a TOEFL score
  and no TOEFL calibration runs in the interim.
- Calibration Brief §2.1's TOEFL row is superseded by the corrected scope in review §5.1
  (three task types, ≥25 samples each, 1.0–6.0 scale). No samples on the old tasks.
- The rebuild interacts with [ADR 0002](0002-writing-evaluation-scoring-models.md): the new
  TOEFL tasks are 4-dimension, so the historical "TOEFL = 3 categories" assumption (and the
  comment in `evaluation.py` that justifies the nullable 4th slot by citing TOEFL) is retired —
  the nullable slots exist because criterion count varies by exam, full stop.
- Per-task timing (the 7-minute Write-an-Email window, finding 1.10) and adaptive delivery
  (Reading/Listening, finding 1.13) are Exam-Simulation-engine concerns, recorded here but out
  of scope until that engine is built; Phase 1 Exam Simulation stays fixed-form by conscious choice.
- Deferring TOEFL narrows first-launch scope to IELTS Academic (EN). This is a deliberate
  sequencing call, not a scope cut — DELF (FR) and TOEFL remain Phase 1 targets, sequenced after
  the IELTS anchor.
