# LinguaMentor — Writing-Evaluation Scoring Models

**Document type:** Architecture decision record
**Patches:** Master PRD §8.2 (Supported Exams — rubric categories), §21.2 (Rubric Categories & Composite Score), §22 (Four-Dimensional CEFR Profiling — rubric feed)
**Phase:** Phase 1 — pre-launch
**Status:** Accepted, pending implementation
**Last updated:** 2026-07-09

---

## 1. Context

The Master PRD (§21.2) specifies one composite scoring formula for every writing exam:
`Overall = Σ(category × 0.25)` on a unified 0.0–9.0 band scale, with "DELF percentage
converted to equivalent band for unified display." The Writing Evaluation Engine
(Slices 1–5) implements exactly this: `LLMCategoryScore.score` is a continuous
`Decimal(ge=0, le=9)` in 0.5 increments; `compute_overall_band` is a flat weighted mean;
the rubric-injection prompt tells the model to "score each category on a 0.0–9.0 scale"
identically for every exam. All five exam YAMLs (`ielts_academic`, `ielts_general`,
`toefl_ibt`, `delf_b1`, `delf_b2`) share that shape; `WritingScoreBreakdown` has exactly
four category slots and `schemas.py` hard-caps `categories` at `max_length=4`.

The exam-reality review ([`docs/research/exam-ground-truth-reference.md`](../../research/exam-ground-truth-reference.md),
findings 1.6 and 1.12) establishes two facts that this design gets wrong:

1. **DELF/DALF have not used continuous per-criterion point weights since September 2022.**
   France Éducation International's ALTE-aligned grid scores each criterion into one of four
   fixed ordinal tiers — *non répondu* → 0, *en dessous du niveau ciblé* → 1, *au niveau ciblé*
   → 3, *au niveau ciblé+* → 5 — which sum to a raw /25 per skill. The grid also carries
   deterministic automatic-zero overrides (fully off-topic zeros 3 of 5 criteria; under-50%
   word count zeros the exercise; blank zeros everything). Modeling DELF as a continuous
   0–9 weighted mean is not a display simplification — it changes what the AI is asked to
   produce and what we would calibrate it against.

2. **Register/sociolinguistic appropriateness (*adéquation sociolinguistique*) is a distinct,
   separately-scored criterion in DELF and TCF** (review §3.9). IELTS/TOEFL fold it into Task
   Response, so a schema modeled on IELTS's four categories has no slot for it. DELF's real
   criterion set is five (task realization, coherence/cohesion, sociolinguistic adequacy,
   lexique, morphosyntaxe) — one more than the schema can hold.

This matters *now*, not later: DELF B1/B2 are in Phase 1 scope, and DELF B2 is a Phase 0
calibration target. Calibrating the AI against human DELF graders using the wrong scoring
model would build the credibility gate on sand — the exact failure Phase 0 exists to prevent.

## 2. Decision

Reject the single-universal-formula premise. Make the scoring shape a property of the exam,
expressed as configuration data (not a code branch on `exam_id`, per the standing convention
in `project-structure-and-conventions.md` §8).

### 2.1 A `scoring_model` dimension in exam config

Every exam YAML gains a `scoring_model` field. Phase 1 defines two values:

- **`banded_continuous`** — the current behavior. Per-criterion continuous score on the exam's
  band scale, weighted-mean composite. Applies to **IELTS Academic** (and General Training).
  Unchanged.
- **`ordinal_tiered`** — per-criterion classification into one of the fixed tiers `{0, 1, 3, 5}`,
  summed to a raw total, with the exam's automatic-zero override rules applied before summing.
  Applies to **DELF B1/B2** (and DALF when it lands).

The writing engine branches on `scoring_model` read from config: `LLMCategoryScore` accepts a
continuous `Decimal` under `banded_continuous` and one of `{0,1,3,5}` under `ordinal_tiered`;
`compute_overall_band` uses the weighted mean or the tier-sum path accordingly;
`prompt_builder` injects a "score on the band scale" instruction or a "classify into one of
these four tiers, using the tier descriptors as anchors" instruction accordingly. The
classify-then-convert shape is also, per finding 1.6, likely *easier* to calibrate (a 4-class
classification target rather than a regression target).

### 2.2 Native scoring and native calibration for `ordinal_tiered`

DELF is **stored and calibrated in its native ordinal model** — the raw tier scores and the
/25 sum are the source of truth and the Phase 0 correlation target. A conversion to the unified
0–9 band exists **for cross-exam display only** (the 4D CEFR radar, progress comparability). The
converted band is never the calibration target: calibrating against a converted-to-continuous
score would reintroduce exactly the construct mismatch this ADR removes.

### 2.3 Register/sociolinguistic as a first-class criterion; lift the 4-criterion cap

Register/sociolinguistic adequacy becomes its own rubric criterion where the exam scores it
distinctly (DELF now; TCF when it lands). The hard 4-category cap is lifted: `schemas.py`
raises `categories` `max_length` to accommodate DELF's five criteria (making the bound
config-derived rather than a magic literal is the preferred form), and `WritingScoreBreakdown`
gains an additive, nullable `category_5_*` column set — the same nullable-slot pattern the
table already uses for exams with fewer criteria. Additive-only, consistent with the Phase 1
migration rule (PRD §28.2).

### 2.4 Scope

- **Implement before DELF B1/B2 enter Phase 0 calibration.** This is the gating dependency.
- **IELTS Academic is unaffected** — it is already correct under `banded_continuous`.
- **The cross-skill hard floor** (DELF fails if any *skill* < 5/25) is an exam-level / readiness
  concern spanning multiple skills, not a single-essay writing-score concern — it is decided
  separately in [ADR 0004](0004-readiness-prediction-exam-dependent-output.md) and enforced at
  exam-simulation / readiness time. This ADR covers only the per-essay writing model (per-criterion
  tiers + the essay-level automatic-zero overrides).
- **TOEFL's scoring shape** is settled separately in
  [ADR 0003](0003-toefl-ibt-2026-redesign.md); its config is marked non-production there, so it
  is out of this ADR's immediate implementation path.

## 3. Consequences

- A schema + engine change touching four files together: the DELF YAMLs, `schemas.py`
  (`LLMCategoryScore` shape + category bound), `engine.py` (`compute_overall_band` branch), and
  `prompt_builder.py` (per-model rubric instruction). Plus an additive migration for
  `category_5_*` on `WritingScoreBreakdown`. The `NUMERIC(4,2)` score-column convention still
  holds — tier points and converted bands both fit.
- The "TOEFL = exactly 3 categories, 4th slot nullable" justification in `evaluation.py` is
  superseded: the 4th (and now 5th) slot is nullable simply because criterion count varies by
  exam, not because of any one exam. ADR 0003 revisits TOEFL's own count.
- DELF Phase 0 calibration is **blocked** until this lands — an intended gate, not a regression.
- The unified-display band remains available for cross-exam UI, so the 4D CEFR radar and
  dashboard comparability (PRD §22) are unaffected.
- Future French exams (TCF, DALF) inherit `ordinal_tiered` for free — the model is now a config
  value, not a per-exam code path.
- **Not solved here:** the display-band conversion table for `ordinal_tiered` exams needs
  authoritative anchors (DELF /25 → CEFR/band); until calibration produces them, the conversion
  is provisional and must be labeled as such on any report, consistent with the calibration-
  transparency promise (PRD §21.3).
