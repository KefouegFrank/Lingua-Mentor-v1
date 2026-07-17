# LinguaMentor — SRS Priority Formula, Volatility, and Schedulable Dimensions

**Document type:** Architecture decision record
**Patches:** Master PRD §23.3 (SRS priority formula, state persistence)
**Phase:** Phase 1 — Core Platform (§61, "SRS scheduler service")
**Status:** Accepted
**Last updated:** 2026-07-17

---

## 1. Context

§61 requires an SRS scheduler with "per-dimension interval tracking, priority formula, Redis
state". §23.3 gives the formula:

```
Priority = (days_since_last_practice × 0.4) + ((1 - last_skill_score) × 0.4) + (volatility_factor × 0.2)
```

Three things block a literal implementation.

**The terms are on different scales.** `last_skill_score` is normalized 0–1 by §23.1, and
`volatility_factor` reads as a 0–1 factor. `days_since_last_practice` is an unbounded day count.
At 10 days the first term is 4.0 while the other two cannot exceed 0.4 and 0.2 combined — the
0.4/0.4/0.2 weights, which only make sense as a blend of comparable quantities, decide nothing.
Ranking collapses to "least recently practiced", and §23.3's own forgetting-curve intent (the
per-dimension interval) never enters the score.

It is also a live overflow: `daily_sessions.srs_priority_score` is `NUMERIC(5,3)`, capping at
99.999. An unbounded first term crosses that at 250 days since practice, so a returning learner
would fail the insert. The column's own precision is evidence the formula was never meant to
grow without bound.

**`volatility_factor` is undefined.** The term appears in this formula and nowhere else. The
nearest definition is §25.1's `stability_factor`, "derived from score variance — high variance
lowers the factor".

**Not every dimension is practicable in Phase 1.** §23.2 names six. `comprehension` already has
no SRS columns in `skill_vectors` — the schema settled that one. `pronunciation` and `fluency`
are only measurable through the Voice Agent (Phase 2, ADR 0005). A never-practiced dimension is
maximally urgent under any reading of the formula, so scheduling them in Phase 1 means SRS
permanently recommends a skill the product cannot yet teach, and §61's daily micro-session
(item 10) has no generatable content.

## 2. Decision

### 2.1 `days_since_last_practice` is normalized to an overdue ratio

```
overdue_ratio = min(days_since_last_practice / repetition_interval, 1.0)
Priority = (overdue_ratio × 0.4) + ((1 - last_skill_score) × 0.4) + (volatility_factor × 0.2)
```

Priority now lands in 0–1 and the published weights carry their stated meaning. The divisor is
the dimension's own `repetition_interval` — the forgetting-curve parameter §23.3 already
tracks and doubles — so "due" means due *relative to this skill's schedule*, which is what
skill-level SRS is for. Normalizing against a constant (e.g. the 30-day cap) would ignore the
interval and quietly undo the doubling ladder §23.3 specifies.

A dimension never practiced (`last_practiced_at IS NULL`) scores `1.0`: never practiced is
maximally overdue.

The weights, the doubling ladder, the 30-day cap and the reset-to-1-day-on-failure are
unchanged. This ADR rescales one input; it does not retune the model.

### 2.2 `volatility_factor` is the normalized recent variance of that dimension

Per-dimension score history lives in `daily_sessions` (`skill_targeted`, `post_session_score`).

```
volatility_factor = min(2 × stdev(last 5 post_session_scores for the dimension), 1.0)
```

Scores are bounded 0–1, so their standard deviation cannot exceed 0.5; doubling maps the range
onto 0–1. This is the inverse of §25.1's `stability_factor` ("high variance lowers the factor"),
which is the only definition the PRD offers, and it makes an unstable skill compete for practice
sooner — the behaviour the term exists to produce.

Fewer than two observations yields `0.0`. No history is not evidence of stability, but it is
also not evidence of volatility, and inventing a number here would move rankings on noise. In
Phase 1 `daily_sessions` stays empty until item 10 ships, so this term contributes nothing yet
and starts contributing on its own once sessions exist.

### 2.3 Phase 1 schedules writing-derived dimensions only

Schedulable in Phase 1: `grammar`, `vocabulary`, `coherence`.

Excluded: `pronunciation` and `fluency` until the Voice Agent lands (Phase 2), and
`comprehension` permanently-for-now, per the schema. The set is a single constant in the engine,
not a branch at each call site: Phase 2 adds two entries to it and nothing else changes.

## 3. Consequences

- Priority is bounded 0–1, so `NUMERIC(5,3)` cannot overflow and `NUMERIC(4,3)` would have
  sufficed. The column is left as specified — it is wider than needed, not wrong.
- A skill practised exactly on schedule and one a year overdue both score `1.0` on term 1.
  That is intended: past due is past due, and the tie breaks on skill score, which is the signal
  worth acting on. This is a deliberate loss of information versus the literal formula.
- Phase 1 priorities are driven by two terms, not three. Rankings will shift once
  `daily_sessions` starts producing history — expected, not drift.
- Anyone reading §23.3 literally will compute different numbers than this system does. That is
  the point of this record.
- The 30-day interval cap and the 0–1 overdue clamp interact: a dimension at the cap reads
  fully overdue after 30 days and stays there. Acceptable — at that interval the learner has
  demonstrated sustained mastery and the skill-score term dominates the ranking.
