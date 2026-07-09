# Research & reference

This folder holds **evidence**, not decisions. Everything here exists to inform
an ADR or a PRD reading — it is background a decision was made *against*, not the
decision itself. The distinction matters because it changes how these files age:

- An **ADR** (`docs/architecture/adr/`) is immutable and states *what we decided
  and why, at a point in time*. It never goes stale because it never claims to
  describe the present.
- A **research file here** describes *the world as some source reported it* on a
  given date. It can go stale the moment an exam board changes a rubric or ETS
  redesigns a test — so every file here is dated, and cites its sources, and is
  expected to be superseded rather than edited in place when reality moves.

If a research file drives a decision, that decision belongs in an ADR that cites
the file — not in the file itself. Don't put "therefore we will…" conclusions
here; put the finding here and the resolution in the ADR.

---

## What's here

### `exam-ground-truth-reference.md`
A consolidated review (July 2026) of how IELTS, TOEFL iBT, DELF/DALF, TCF Canada,
and TEF Canada actually work — structure, official rubrics, scoring mechanics,
accent policy, and prior AI-scoring art — checked against the Master PRD and the
Phase 0 Calibration Brief. Its Section 3 (paraphrased rubric descriptors per
exam/task) is the working reference for rubric-injection prompt engineering.

**Sourcing caveat carried from the source:** the rubric descriptor language is
*paraphrased*, not quoted — the underlying grading documents are copyrighted.
License or access the primary sources (British Council/IDP band descriptors, ETS
scoring guides, France Éducation International grilles) before shipping any of
Section 3 into a production prompt.

### `exam-reality-traceability.md`
The track-and-trace matrix: every finding from the reference above → where it
touches the codebase (file:line) → the ADR that resolves it → status. This is the
one place to confirm no finding was silently dropped.

---

## What does NOT belong here

Decisions (→ ADRs), product intent (→ the PRD, patched via ADRs), operational
procedure (→ `docs/runbooks/`). If you're tempted to write a recommendation or a
plan here, it belongs in an ADR instead.
