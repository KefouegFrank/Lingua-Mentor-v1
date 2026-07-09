# LinguaMentor — Phase 0 Calibration-Gate Hardening

**Document type:** Architecture decision record
**Patches:** Phase 0 Calibration Brief §2 (Scope), §3 (Examiner Requirements), §6 (Correlation Analysis / gate criteria), §9 (Go/No-Go Decision Gate)
**Phase:** Phase 0 — pre-launch (runs parallel to Phase 1)
**Status:** Accepted, pending implementation
**Last updated:** 2026-07-09

---

## 1. Context

Phase 0 is the single non-negotiable gate in the delivery plan: no AI writing score reaches a
user until AI-to-human Pearson correlation ≥ 0.85 is confirmed. The current harness
(`apps/ai-service/app/calibration/harness.py`) computes exactly that — overall and per-category
Pearson `r` against the 0.85/0.80 gates, plus a divergence list — and nothing else.

The exam-reality review ([`exam-ground-truth-reference.md`](../../research/exam-ground-truth-reference.md))
surfaces several ways the gate as specified is narrower or less accurate than it should be. None
change the 0.85 target; they harden and correct what sits around it. Findings: 1.5 (no
adversarial testing), 1.4 (0.85 is ambitious, not routine), 1.9 (IELTS marking model), 1.15
(pipeline-integrity failures), 1.16 (examiner terminology), 1.17 (TCF scope ambiguity), and the
IELTS–CEFR boundary fuzziness in review §2.1.

## 2. Decision

### 2.1 Adversarial / gaming-resistance testing is a hard gate (finding 1.5, review §5.4)

Add a bad-faith adversarial test set per exam type to the Go/No-Go criteria — responses
constructed to exploit likely scoring shortcuts (keyword stuffing, paragraph repetition,
memorized-template structures, sophisticated vocabulary wrapped around logically empty or
off-topic content). **The AI scorer must not systematically over-score this set relative to a
human examiner's judgment**, expressed as a concrete gate (e.g. an `ADVERSARIAL_GATE` in the
harness: gamed samples must score at or below a stated ceiling / must not exceed their
human-assigned score by more than a set margin). This is a decades-documented vulnerability class
(ETS's "Stumping e-rater," Powers et al., 2002 — one essay scored well after repeating the same
paragraph 37 times), and it is currently untested anywhere in the codebase (zero repo hits for
adversarial/gaming). It becomes a hard gate alongside Pearson and WER, not an optional add-on.

### 2.2 WER is specified but not implemented — tracked as a build item (finding 1.4 context)

The Calibration Brief requires WER < 10% per accent target as a hard gate, but no WER computation
exists in the harness or anywhere in the codebase. This ADR records that gap explicitly: WER is a
**required, unbuilt** part of the Phase 0 gate, to be implemented when the speaking/pronunciation
calibration line is built (it depends on the ASR path, which is Voice-Agent-adjacent, Phase 2).
Until then the harness gates writing (Pearson) only, and that limitation must be stated on any
Phase 0 status report so a partial pass isn't mistaken for a full one.

### 2.3 The 0.85 target keeps a documented iteration budget, not a bare binary (finding 1.4)

Prior art cuts both ways: e-rater/SpeechRater meet or exceed human-human agreement, and IELTS's
*own* inter-examiner reliability is only 0.83–0.86 (Speaking) / 0.81–0.89 (Writing) — so 0.85 is
"as good as humans agree with each other," not arbitrary. But an independent academic IELTS
essay-scorer reached only MAE 0.66 bands after multiple failed iterations, with high-band essays
hardest. The gate stays at 0.85; this ADR reaffirms the PRD Risk Register's treatment of
"calibration fails to reach 0.85" as the highest-likelihood/highest-impact risk, and directs that
Phase 0 budget real tuning cycles with a documented interim-gate + improvement-plan path rather
than a single binary pass/fail with no fallback. Launch is delayed on a miss, never silently shipped.

### 2.4 Data-pipeline integrity is a Go/No-Go criterion (finding 1.15)

Score-integrity failures come from mundane pipeline bugs as readily as from AI miscalibration —
Cambridge/IELTS was fined £875,000 by Ofqual over answer-key ordering and diacritic mishandling,
not AI. Add data-pipeline-integrity checks to Go/No-Go: the score a user sees is the score the
engine produced (no ordering/rounding/encoding corruption between engine output, persistence, and
report), verified end-to-end before launch. The existing `NUMERIC(4,2)` no-float-drift convention
is one instance of this discipline; this makes the broader property an explicit gate.

### 2.5 Correctness/terminology fixes to the Brief

- **Examiner credential (finding 1.16):** "CIEP-accredited examiner" → **France Éducation
  International-accredited (*habilité*)**; CIEP was renamed in 2019. The credential is an
  *habilitation* on a **5-year** renewal cycle — distinct from IELTS's 2-year recertification.
- **TCF scope (finding 1.17):** pin the Brief to **TCF Canada** specifically (IRCC, 4 mandatory
  modules), explicitly distinct from **TCF Québec** (MIFI/CSQ, oral-weighted) and **TCF Tout
  Public** (general certification). A Québec-bound candidate's test and points formula differ
  materially; conflating them corrupts sample collection.
- **CEFR-classification metric (review §2.1):** the flat "≥90% CEFR classification accuracy"
  target ignores that the official IELTS↔CEFR mapping is fuzzy (the C1 threshold falls *between*
  bands 6.5 and 7). Replace flat accuracy with a **boundary-aware metric** — tolerance at CEFR
  boundaries, or an adjacent-agreement measure — so inherent labeler disagreement at boundaries
  isn't scored as model error.
- **IELTS marking model (finding 1.9):** the Brief's "≥2 independent examiners" is well-grounded
  for DELF/DALF/TCF (mandatory double-blind marking) but *exceeds* live IELTS practice, which is
  single-examiner + statistical "jagged profile" flagging. Describe the redundancy requirement
  per exam accurately. Note this also validates our own Score Appeal Flow: "flag discrepancy →
  secondary evaluation" mirrors both IELTS's flagging and TOEFL's AI-flags-for-human-review — real
  precedent, not novel design.

## 3. Consequences

- The harness gains an adversarial gate and (later) a WER gate; `test_harness.py` gains adversarial
  cases. The adversarial sample set and its ceiling are a product/AI-ML call to author — the code
  shape is a straightforward extension of the existing gate structure, no schema change.
- Phase 0 status reporting must distinguish "writing Pearson gate passed" from "full Phase 0 gate
  passed," since WER and the pronunciation line are unbuilt until Phase 2 — a partial pass is a
  no-go, consistent with the Brief's own §9.
- The Brief's terminology, TCF scope, CEFR metric, and examiner-redundancy language are superseded
  by §2.5 above; the TOEFL scope row is superseded by [ADR 0003](0003-toefl-ibt-2026-redesign.md).
- No change to the 0.85 / 0.80 thresholds themselves — the gate is hardened and corrected around
  them, not loosened.
- **Not solved here:** authoring the actual adversarial corpora per exam, and building the WER
  path — both are execution tasks gated on later slices (the adversarial corpus can begin during
  Phase 0 data collection; WER waits on the ASR path).
