# LinguaMentor — Accent-Relative Scoring Is an Engineering Choice, Not Exam Replication

**Document type:** Architecture decision record
**Patches:** Master PRD §4.4 (Defensible Differentiators), §7.2 (Accent Configuration), §20.4 (Accent-Relative Pronunciation Scoring), §26 (AI Ethics — accent fairness)
**Phase:** Phase 1 decision; first affects code at the Voice Agent build (Phase 2)
**Status:** Accepted
**Last updated:** 2026-07-09

---

## 1. Context

The Master PRD makes accent handling a headline differentiator and repeatedly frames it as
*matching how real exams score pronunciation*:

- §4.4: "Accent-relative pronunciation scoring — pronunciation evaluated against the learner's
  chosen target accent … making the system fair and **exam-appropriate**."
- §7.2: "Pronunciation is scored relative to the target accent baseline … **This is
  pedagogically correct (IELTS accepts all standard accents)**."
- §20.4: "Pronunciation is evaluated relative to the learner's configured target accent …
  **This is the pedagogically correct approach: IELTS explicitly accepts all standard English
  accents**."
- §26: "Accent fairness — Pronunciation scoring calibrated independently for each supported
  accent — no accent is penalized for not matching en-US baseline."

The exam-reality review ([`exam-ground-truth-reference.md`](../../research/exam-ground-truth-reference.md),
finding 1.7) shows this framing conflates two different things. IELTS's public Pronunciation
band descriptors, at **every band**, judge intelligibility with an L1 accent explicitly allowed —
against **no reference accent at all**. There is no "target accent" construct anywhere in the
official IELTS scoring system; examiners are trained across a global accent range precisely so
that no dialect is a baseline. France Éducation International's DELF grid states the same
intelligibility-not-native-likeness principle. **No researched exam body scores pronunciation
against an accent baseline.** So "IELTS accepts all standard accents" is true — but it is true
because IELTS is accent-*neutral*, which is a different mechanism from scoring *relative to a
configurable target-accent baseline*. The PRD presents an engineering design as a replication of
examiner behavior it does not, in fact, replicate.

Two things make this the right time to settle the framing rather than later. First, the claim
lives **only in PRD prose** — no code implements accent scoring yet (the Voice Agent engine and
the STT/TTS providers are one-line stubs; `accent_target` exists as a DB column with no logic
behind it). Second, the Voice Agent (PRD §20, Phase 2) is the first place this becomes code, and
building it on the current framing would bake an inaccurate rationale into the pronunciation
scorer and its user-facing explanations.

## 2. Decision

Record accent-relative scoring as a **deliberate ASR/TTS engineering and product choice made for
fairness and learner experience — explicitly not a replication of any real exam's pronunciation
methodology.**

The honest rationale, which stands on its own without the false exam-fidelity claim:

- ASR accuracy and pronunciation feedback are genuinely better when the system knows which target
  accent a learner is aiming for (model routing, phoneme-map alignment). This is an engineering
  fact about speech pipelines, independent of how exams grade.
- Giving learners in Africa, Asia, and the Americas a chosen target accent (en-US, en-UK, fr-FR,
  fr-CA) to be measured *toward* is a defensible product and equity choice for a practice tool.
- **What it is not:** a mirror of exam scoring. Real exams (IELTS, DELF) are accent-neutral and
  judge only intelligibility with no reference dialect. Our design deliberately diverges from that
  for the reasons above.

Consequently:

- The Voice Agent's pronunciation scorer and any user-facing copy must describe accent-relative
  scoring as *our* fairness/practice choice, and must not claim it reproduces examiner behavior.
  The accent-fairness bias audit (PRD §26) remains valuable — it just verifies *our* per-accent
  parity, not fidelity to an exam that has no accent baseline.
- Learners preparing for a real exam should, where relevant, be told the exam itself scores
  intelligibility accent-neutrally — so our accent-relative feedback is practice guidance, not a
  prediction of how an examiner would weigh their accent.

This ADR patches the framing in §4.4/§7.2/§20.4/§26. It does **not** change the accent feature
itself: `accent_target` stays a first-class parameter, the four Phase-1 accents stand, and the
per-accent bias audit stands. Only the *justification* is corrected — from "replicates IELTS" to
"a deliberate engineering choice that diverges from accent-neutral exam scoring on purpose."

## 3. Consequences

- No code change today (nothing implements accent scoring yet). The decision binds the Voice Agent
  build (Phase 2): its scorer, feedback copy, and any "exam-appropriate" claims must reflect the
  corrected framing.
- The Phase 0 pronunciation calibration (WER per accent, accent-bias audit) is unaffected in
  substance — it measures our per-accent parity, which is exactly what an engineering-choice
  framing calls for.
- Marketing/product copy that leans on "scores you like a real examiner does" for pronunciation
  needs revising to avoid a claim we can't defend against the actual exam rubrics.
- This is a documentation/framing correction; if a later decision reverses it (e.g. a deliberate
  move to accent-neutral scoring to mirror exams), that is a **new ADR superseding this one**, per
  the ADR immutability rule.
