# LinguaMentor — Master Exam Ground-Truth & Rubric Reference

**Prepared for:** LinguaMentor dev team / AI-ML engineering / Product Lead
**Research date:** July 2026
**Status in this repo:** landed reference (evidence). Decisions drawn from it live in
ADRs 0002–0006; the finding→decision map is in
[`exam-reality-traceability.md`](exam-reality-traceability.md).

> **Editorial note for this repo copy:** decorative separator images from the original
> have been removed and character encoding normalized to Unicode; wording is otherwise
> faithful to the source. This file is *dated evidence* — when an exam board changes a
> rubric, supersede this file with a new dated one rather than editing it in place.

**Purpose:** A single, consolidated reference — merging two independent research passes and
a rubric-engineering appendix — on how IELTS, TOEFL iBT, DELF B2, DALF C1/C2, TCF Canada,
and TEF Canada actually work: structure, timing, official rubrics, scoring mechanics,
delivery mode, and existing AI-scoring precedent. Cross-referenced against the Master PRD
and Phase 0 Calibration Brief throughout.

**Sourcing note:** Findings are drawn from official exam-body sources (ielts.org, ets.org,
france-education-international.fr, cci-paris-idf.fr) where available, cross-checked against
secondary/prep sources and the TOEFL iBT Technical Manual (via third-party summary in some
cases — flagged explicitly) where official documentation was incomplete. Ambiguous or
conflicting points are flagged rather than presented as settled fact. **Rubric descriptor
language in Section 3 is paraphrased, not quoted** — the underlying official grading
documents are copyrighted; before shipping any of Section 3 into a production prompt,
license or access the primary source directly (British Council/IDP Band Descriptor PDFs,
ETS's TOEFL Scoring Guides, France Éducation International's grille d'évaluation documents,
FEI's TCF corrector materials).

---

## 0. How to use this document

- **Section 1** — every finding, ranked 🔴 critical / 🟠 high / 🟡 medium / 🟢 low. Read this first.
- **Section 2** — full exam-by-exam ground truth (structure, scoring, grading model, accent policy, AI precedent).
- **Section 3** — Rubric Reference Appendix: paraphrased tier-level descriptors per exam/task, for direct use in prompt/rubric-injection engineering, plus a cross-exam criterion mapping table.
- **Section 4** — every finding mapped to a specific PRD/Calibration Brief section, with a suggested action.
- **Section 5** — drop-in-ready replacement/addition language for the three highest-priority fixes.
- **Section 6** — open questions not yet resolved.

---

## 1. Executive Summary — Findings Ranked by Impact

### 🔴 Critical — likely blocks or invalidates current Phase 0 design as written

**1.1 — TOEFL iBT was completely overhauled on January 21, 2026, weeks before the Master
PRD's own "Updated: 2026-02-23" date.** The task types the Calibration Brief specifies —
"Integrated + Independent Writing," essays scored "14–30" — **no longer exist in the live
exam.** This was the second major TOEFL redesign in three years: a July 2023 redesign first
shortened the test (~3h → ~116 min) and replaced the old Independent Writing essay with
"Writing for an Academic Discussion"; the January 2026 redesign went much further, replacing
the 2-task Writing section entirely with 3 new tasks (Build a Sentence, Write an Email,
Writing for an Academic Discussion), removing Independent Speaking entirely, making
Reading/Listening multistage-adaptive, and adding a new 1.0–6.0 CEFR-aligned primary scale
(0–120 retained only as a legacy companion figure through 2026–2028). **Any essay/response
samples collected against the old task types would be calibrating against tasks ETS no
longer administers** — this needs fixing before Phase 0 data collection begins, not after.

**1.2 — TCF Canada's actual output metric is NCLC, not CEFR — and this doesn't match the
PRD's unified "4D CEFR profile" data model.** TCF Canada scores each skill independently and
converts to NCLC (Niveaux de Compétence Linguistique Canadiens, 1–12), a Canada-specific
scale IRCC uses directly for Express Entry CRS point calculations. NCLC is CEFR-*adjacent*
(NCLC 7 ≈ B2) but is not a rebadged CEFR — it has its own official conversion table,
maintained by a different body (Canadian government) than CEFR (Council of Europe).
Reporting CEFR-only to TCF Canada users gives them the wrong unit for their actual use case.
**Requires either a second, exam-specific output scale (NCLC) or an explicit conversion layer.**

**1.3 — TEF Canada is entirely missing from the Calibration Brief's scope, despite being a
co-equal, competing exam to TCF Canada for the same immigration use case.** TEF Canada is
administered by CCI Paris Île-de-France (a chamber of commerce), a completely different body
from TCF Canada's France Éducation International. Both are independently IRCC-accepted;
candidates choose based on availability/cost/preference. Each has its **own separate official
conversion table to NCLC/CLB** — scores aren't comparable across the two without going through
their respective tables. Full coverage of the Canadian French-immigration market requires TEF
Canada to have its own calibration line, sample collection, and rubric injection.

**1.4 — The ≥0.85 Pearson correlation target is genuinely ambitious, not routine — grounded
in real prior-art results on both sides of the argument.** Two data points cut in opposite
directions and both matter:

- **Evidence it's achievable:** ETS's e-rater/SpeechRater (in production for TOEFL/GRE for
  over a decade) has published Human-Machine correlations that meet or slightly exceed
  Human-Human agreement (per third-party summary of the TOEFL Technical Manual — **verify
  against the primary ETS manual before citing externally**: Speaking Human-Machine ≈0.89 vs.
  Human-Human ≈0.96). Separately, **published IELTS inter-examiner reliability is only
  0.83–0.86 (Speaking) and 0.81–0.89 (Writing)** — meaning two certified human IELTS examiners
  themselves only agree in roughly this range, which reframes 0.85 as "as good as human
  examiners agree with each other," not an arbitrary bar.
- **Evidence it's hard:** an independent academic attempt at IELTS automated essay scoring
  (transformer-based, DistilBERT + regression head) only reached MAE 0.66 bands after multiple
  failed earlier iterations (rule-based approaches produced *negative* R² — worse than a
  flat-line guess), with higher-band essays flagged as the hardest to score accurately. This
  was achieved without 20+ years of test-specific feature engineering the way e-rater has had.

**Recommendation:** don't treat ≥0.85 as a routine bar; budget real iteration cycles, and
consider a documented interim gate with an improvement plan rather than a single binary
pass/fail with no fallback (the PRD's own Risk Register already treats this as the
highest-likelihood, highest-impact risk — this finding reinforces that judgment with hard numbers).

**1.5 — 🔴 No adversarial/gaming-resistance testing exists anywhere in the Phase 0 Go/No-Go
criteria — a decades-old, well-documented threat class for exactly this kind of system.**
ETS's own commissioned "Stumping e-rater" study (Powers et al., 2002) found that essays
deliberately engineered to exploit the scoring engine — including **one essay that scored well
after repeating the same paragraph 37 times** — could still receive high automated scores;
other adversarial essays used complex sentence structure, sophisticated vocabulary, and
topic-relevant keywords with faulty logic or off-topic content to also outscore what a trained
human reader would award. This is a known, citable, and still-relevant vulnerability class for
any NLP/LLM-based writing scorer, including LinguaMentor's. Given Phase 0 is described as the
single most reputation-critical, non-negotiable gate in the delivery plan, adversarial/
"bad-faith" sample testing seems like a natural and currently-missing addition alongside the
correlation and WER targets.

**1.6 — 🔴 The DELF/DALF scoring *mechanism itself* changed in September 2022, and this should
directly shape the Writing/Speaking Evaluation Agent's output schema for the French exams.**
France Éducation International researched (2019), finalized (March 2022), and deployed
(September 2022) a new grading methodology built to ALTE (Association of Language Testers in
Europe) standards:

- **Criteria were reduced to 5–6 total, identical across all six CEFR levels (A1–C2)**, grouped
  into three competency domains: *Compétence pragmatique* (task realization + coherence/cohesion),
  *Compétence sociolinguistique* (a single register-appropriateness criterion), and *Compétence
  linguistique* (lexique + morphosyntaxe, plus *système phonologique* for oral only).
- **Examiners no longer assign a free point value per criterion.** They classify performance
  into one of **four fixed ordinal tiers**, each mapped to a fixed point value: *Non répondu /
  production insuffisante* → 0; *En dessous du niveau ciblé* → 1; *Au niveau ciblé* → 3; *Au
  niveau ciblé+* → 5.

Confirmed exact structure for **DELF B2 Production Orale**: 5 criteria (task realization —
monologue; task realization — interaction; lexique; morphosyntaxe; phonological mastery), each
0/1/3/5, summing to /25. **Any reference material describing DELF/DALF scoring as fixed
continuous point weights (e.g., "lexique = 4 points, morphosyntaxe = 5 points, phonology = 3
points") reflects the pre-September-2022 grid and is now outdated.**

**Recommendation:** for the French exam types, design the Writing/Speaking Evaluation Agent's
JSON output schema as a two-step process — classify each criterion into 1 of 4 official ordinal
tiers (using real performance descriptors as the classification anchor), *then* apply the fixed
point conversion — rather than free continuous scoring. This is both more construct-valid and
likely easier to calibrate (4-class classification vs. regression). This reform also reconfirms,
now for DELF specifically (not just DALF), that **double evaluation by two independent, named
examiners is official, mandatory policy for every level and skill** — the current official grid
has explicit dual-examiner signature fields.

### 🟠 High — architectural mismatches that will cause real product/scoring inconsistencies if unaddressed

**1.7 — Accent-neutrality is explicit, official, trained policy across every exam researched —
English and French alike — and directly conflicts with the "accent-relative scoring" design.**
IELTS's public Pronunciation band descriptors state at every band that an L1 accent has
"minimal effect on intelligibility" as long as speech is clear; examiners are trained across a
global range of accents and grade against no reference accent at all — there is no "target
accent" construct anywhere in the official IELTS scoring system. France Éducation
International's DELF grading documentation states the same principle almost word-for-word — an
official DELF B1 self-assessment document even includes the checklist line "my accent does not
hinder comprehension" as the standard being measured. **No researched exam body defines
pronunciation scoring around an accent baseline.** LinguaMentor's accent_target design
(en-US/en-UK/fr-FR/fr-CA baselines, accent-relative bias audits) is a reasonable ASR/TTS
engineering compromise, but it is a deliberate departure from how every real exam scores
pronunciation — this should be stated explicitly in the docs as an intentional product choice,
not a replication of examiner behavior.

**1.8 — Each exam's scoring "shape" is fundamentally different — a single generic Readiness
Prediction Engine output cannot fit all of them.**

- IELTS/TOEFL: simple average of section bands, no per-section floor, banded 0–9 / 0–30 (soon 1–6 for TOEFL).
- DELF/DALF: sum-based /100 with a **hard per-skill floor** (any skill <5/25 fails the whole exam regardless of total) — pass/fail-with-floor, not a continuous band.
- TCF/TEF Canada: **per-skill NCLC levels, no combined "overall" score at all** — IRCC evaluates each skill independently.
- DALF C2 doesn't even separate comprehension from production — only two merged papers exist.

A single "probabilistic band + confidence interval" is the right shape only for IELTS/TOEFL —
wrong for DELF (needs P(pass) with a floor constraint) and incomplete for TCF/TEF Canada (needs per-skill NCLC).

**1.9 — Marking-redundancy assumptions are accurate for France Éducation International exams;
for IELTS, the real mechanism is more specific (and different) than simple double-marking.**
DELF/DALF/TCF Writing are **confirmed double-marked, independently, double-blind** — official
grids carry two named examiner signature fields, with explicit instruction that double
evaluation is mandatory for every level and skill. **IELTS, by contrast, is single-examiner by
default**, using a statistical **"jagged profile" flagging system**: if a candidate's
Writing/Speaking band diverges markedly from their (objectively-marked) Reading/Listening
bands, the response is automatically flagged and re-marked by a senior examiner, combined with
routine targeted-sample monitoring by Principal Examiners. **This is functionally similar to
TOEFL's new AI-flags-for-human-review model and to LinguaMentor's own proposed Score Appeal
Flow ("flag discrepancy → secondary evaluation")** — worth citing as validation that this part
of the architecture already matches two real, independent industry precedents, rather than
presenting it as a novel design. The Calibration Brief's "≥2 independent examiners" requirement
is realistic and well-grounded for the French exams; for IELTS it exceeds standard live-exam
practice rather than replicating it (fine, but should be described accurately).

**1.10 — Task-level timing granularity varies far more than the current Exam Simulation Engine
design (per-section countdown timer) appears to assume.** TCF Canada's Expression Écrite is 3
sub-tasks within one 60-minute section (~10/20/30 min recommended allocations); TOEFL's new
"Write an Email" task has a hard 7-minute window nested inside Writing; DELF B2's Production
Écrite is a single undivided 60-minute block. **Per-task, not just per-section, timer
granularity is needed for at least TCF/TEF and the new TOEFL.**

**1.11 — Exam retake policies differ meaningfully and should be reflected per exam type.** IELTS
now allows "One Skill Retake" (retake one failed section only). TEF Canada and DELF both require
**retaking the entire exam** on failure — no section-level retake exists for either. This
affects how "practice toward a target score" should be framed per exam in the product, and
contradicts any assumption that partial/skill-level retakes are universally realistic.

**1.12 — Register/sociolinguistic appropriateness is scored as its own explicit criterion in
DELF and TCF, but has no distinct slot in IELTS/TOEFL (folded into Task Response).** If the
current rubric-injection schema has no distinct register/sociolinguistic dimension, this is the
single highest-value schema addition to make one shared internal rubric structure actually fit
all four exam families rather than just IELTS/TOEFL. See the cross-exam mapping table in Section 3.

**1.13 — Adaptive difficulty is now a shared trend across exams (TOEFL Reading/Listening since
Jan 2026; TCF Canada's MCQ sections reportedly use a "principe de difficulté progressive") that
doesn't appear to be reflected in the Exam Simulation Engine's current fixed-form design.** Not
necessarily a defect, but worth a conscious decision on whether "Exam Simulation" should mirror
the adaptive delivery model of the tests it's simulating.

### 🟡 Medium — useful context, lower urgency

**1.14 — Real-world AI-scoring competitors already exist for every exam researched** (Speechful,
ieltsonlinetests.com for IELTS; Preplang, TCFCAD for TCF Canada) — none officially validated,
several marketing explicit skepticism of AI grading (one competitor's actual tagline: "IELTS
doesn't trust AI to mark your writing, and neither should you"). LinguaMentor is entering a
market with existing, unvalidated competitors, not a greenfield space.

**1.15 — Real-world quality-assurance precedent, non-AI:** Cambridge English/IELTS was fined
£875,000 by Ofqual after a marking-error incident affecting ~21,717 candidates, caused by
mundane data-pipeline bugs (answer-key ordering errors, mishandling of diacritics), not AI.
Score-integrity failures are as likely to come from boring pipeline bugs as from AI
miscalibration — the Calibration Brief doesn't currently list data-pipeline integrity testing as
a Go/No-Go criterion.

**1.16 — Terminology corrections for the Calibration Brief.** "CIEP-accredited examiner" should
read "France Éducation International-accredited (*habilité*) examiner" — CIEP was renamed in 2019,
and the correct credential term is *habilitation*, on a **5-year renewal cycle** (requiring
Master's-level FLE qualification or 2–3+ years' teaching experience, ~30 hours of training,
mandatory group harmonisation exercises, and a certification test) — distinct from IELTS's
2-year examiner recertification cycle.

**1.17 — "TCF Canada" is one of at least three related-but-distinct France Éducation
International products**, each with different module structures, accepting authorities, and
scoring emphases: *TCF Canada* (4 mandatory modules, for IRCC federal immigration/citizenship),
*TCF Québec* (4 optional à-la-carte modules, for MIFI/Quebec-specific immigration, with oral
skills weighted especially heavily toward CSQ points), and *TCF Tout Public* (general A1–C2
certification, mandatory core + optional Expression add-ons). Worth an explicit confirmation
that "TCF Canada" specifically (not Québec or Tout Public) is the intended scope, since a
Québec-bound candidate's actual test and points formula differ materially.

**1.18 — Exam validity periods are not uniform and shouldn't be treated as a single constant.**
DELF/DALF: valid for life. IELTS/TOEFL/TCF Canada/TEF Canada: valid 2 years. Real
product-messaging and re-testing-cadence difference across Exam Track users.

**1.19 — IELTS uses test-to-test statistical "equating"**, where raw-score-to-band thresholds
can shift by roughly ±1 question between test versions to keep difficulty comparable across
sessions/administrations — a real-world precedent for the kind of ongoing psychometric
calibration LinguaMentor's own scoring pipeline will need to maintain as LLM providers update
models (relevant directly to the PRD's own "quarterly recalibration" / "model update protocol"
sections, which already anticipate this class of problem).

### 🟢 Low — small factual/terminology corrections

**1.20 — Recent methodology reforms may make older reference material stale beyond the Sept-2022
scoring-mechanism change (1.6):** DELF/DALF comprehension sections have moved to 100%
multiple-choice (removing free-response scoring from those two skills, generalized by 2026);
DALF C1 abolished its Sciences vs. Lettres-et-Sciences-Humaines specialty tracks in 2020 (now unified).

**1.21 — 2025–2026 IELTS procedural changes worth reflecting in any exam-simulation UI:** black
pen now mandatory for paper-based tests (Feb 2025); examiners retrained in 2025 to more
aggressively penalize memorized Writing Task 2 templates (can cap Task Response at Band 4.0
regardless of language quality) — relevant if LinguaMentor's own AI scoring doesn't yet penalize
templated/memorized responses the way real 2025-onward examiners do.

---

## 2. Exam-by-Exam Ground Truth Reference

### 2.1 IELTS (Academic & General Training)

**Governing bodies:** British Council, IDP, Cambridge University Press & Assessment (joint owners).

**Format:** 4 sections, ~2h45m total. Listening (30 min, 40 Q, 4 recordings) → Reading (60 min,
40 Q, 3 passages) → Writing (60 min, 2 tasks), same day, no breaks; Speaking (11–14 min
interview) same day or up to ±7 days. Listening/Speaking identical across Academic and General
Training; only Reading and Writing differ (Academic = university-style texts + data-description
essay; General Training = everyday/workplace texts + personal/semi-formal letter). Delivery:
paper-based, computer-delivered, or "IELTS Online" at test-taker's choice where available —
Speaking is increasingly offered via video call at official centres, identical in
content/scoring to in-person, by explicit design choice. Newer option: **"IELTS One Skill
Retake"** — retake a single section instead of the full test.

**Writing rubric (4 criteria, 25% each):** Task Achievement (Task 1) / Task Response (Task 2),
Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy. Task 2 carries more
weight than Task 1 in the combined Writing band. GT Task 1 is a letter (checks communicative
purpose, register appropriateness, coverage of required bullet points), not an essay.

**Speaking rubric (4 criteria, 25% each):** Fluency and Coherence, Lexical Resource, Grammatical
Range and Accuracy, Pronunciation.

**Overall scoring:** average of 4 section bands, rounded to nearest 0.5 (.25 always rounds up to
next half-band; .75 rounds up to next whole band). No per-section floor. Listening/Reading are
objectively, clerically marked (1 point/correct answer out of 40, no negative marking, no partial
credit) — raw score converted to band via a **fixed published conversion table**, which differs
between Academic and General Training Reading but is identical for Listening across both.
**Test-to-test "equating"** shifts raw-to-band thresholds by roughly ±1 question between test
versions. Writing/Speaking are 100% human-marked in every delivery mode.

**IELTS ↔ CEFR mapping is officially fuzzy, not 1:1.** Cambridge English's own research states
the C1 threshold falls somewhere between bands 6.5 and 7 (many 6.5 scorers are C1, some aren't);
Band 8 is "borderline" C2, 8.5+ clearly C2. Approximate mapping: 8.5–9 = C2, 7–8 = C1, 6–6.5 =
B2, 5–5.5 = B1, 4–4.5 = A2, below 3 = below A1. This directly affects the Calibration Brief's
"≥90% CEFR classification accuracy" target — near-boundary bands may have inherent labeler
disagreement baked in.

**Accent policy:** official, explicit, trained neutrality. Public Pronunciation descriptors state
at every band that an L1 accent has minimal effect on intelligibility as long as speech is clear;
examiners are trained across a global accent range and grade against no single reference accent.

**AI-scoring precedent:** none officially — IELTS remains 100% human for Writing/Speaking. A
recent independent academic paper on automated IELTS essay scoring (transformer-based) reached
MAE 0.66 bands after multiple failed earlier approaches. Commercial (unofficial) AI IELTS-prep
tools already exist (e.g., Speechful, ieltsonlinetests.com).

**Marking model — single-examiner by default, not universal double-marking.** IELTS uses a
statistical **"jagged profile"** flagging system: a Writing/Speaking score that diverges markedly
from a candidate's (objectively-marked) Reading/Listening scores is automatically flagged and
re-marked by a senior examiner, combined with routine targeted-sample monitoring by Principal
Examiners rather than universal second-marking.

**Examiner certification:** interview → induction → ~1.5-day training workshop → formal
certification test → **mandatory recertification every 2 years**. ~7,000+ certified examiners.

**Published reliability data:** inter-examiner reliability of **0.83–0.86 (Speaking)** and
**0.81–0.89 (Writing)** — two certified human examiners themselves only agree in roughly this
range, directly contextualizing the 0.85 AI-to-human calibration target.

**2025–2026 procedural changes:** black pen mandatory for paper-based tests (Feb 2025); examiners
retrained in 2025 to more aggressively penalize memorized Writing Task 2 templates (can cap Task
Response at Band 4.0).

**Real-world QA incident:** £875,000 Ofqual fine over a rule-based (non-AI) marking-error incident
affecting ~21,717 candidates, caused by data-workflow bugs.

### 2.2 TOEFL iBT

**Governing body:** ETS (Educational Testing Service).

⚠ **The exam changed twice, and the second change (Jan 2026) invalidates part of the Calibration
Brief as written.**

| | Pre-2023 | 2023–Jan 2026 | Current (from Jan 21, 2026) |
|---|---|---|---|
| Total time | ~3 hours | ~116 minutes | ~85–100 minutes |
| Reading/Listening | Fixed-form | Fixed-form, shortened | **Multistage adaptive** — common first module, then easier/harder second module based on performance; can cap max attainable band |
| Writing | 2 tasks: Integrated (read+listen+write) + Independent (opinion essay, 30 min) | Integrated + "Writing for an Academic Discussion" (replaced old Independent essay) | **3 tasks:** Build a Sentence (binary correct/incorrect) · Write an Email (0–5, 7-min hard window) · Writing for an Academic Discussion (0–5, carried over) |
| Speaking | 6 tasks: 2 Independent + 4 Integrated | 6 tasks, unchanged | **2 tasks, ~8 min total:** Listen and Repeat (7 items, no prep) + Take an Interview (4 items, no prep); **Independent Speaking removed entirely** |
| Scoring | 0–30/section, 0–120 total | 0–30/0–120, unchanged | 0–30/0–120 retained *plus* new **1.0–6.0 CEFR-aligned primary scale** (dual reporting through 2026–2028) |

**Legacy rubric structure:** Writing scored 0–5 holistically per task on development,
organization, language use/facility. Speaking scored on 5 underlying dimensions (Fluency,
Intelligibility, Language Use, Organization, Repeat Accuracy), drawn on selectively per task — a
materially different model from IELTS's 4-equal-criteria split. See Section 3.3–3.4 for
task-level detail.

**AI-scoring precedent — the strongest in this entire research set, and the closest real-world
analog to what LinguaMentor is building.** ETS's **e-rater** (Writing) and **SpeechRater**
(Speaking) — NLP/acoustic-feature-based automated scoring engines — have been used in real
high-stakes TOEFL/GRE scoring for over a decade. **As of the January 2026 redesign, the automated
engine is the primary/first-pass scorer for every response; a human rater reviews only responses
the engine flags as unusual** (low-confidence score, prompt mismatch, suspected
memorized/templated response) — a reversal of the pre-2026 model. Published ETS research (Attali,
Bridgeman & Trapani, 2010) found e-rater's agreement with a human rater on TOEFL Independent/GRE
Issue tasks exceeded agreement between two independent human raters. Per third-party summary of
the TOEFL Technical Manual (**verify against the primary ETS document before external citation**):
Speaking shows Human-Machine correlation ≈0.89 and Human-Human ≈0.96 — both exceeding
LinguaMentor's 0.85 target.

**Known validity threat, directly relevant to LinguaMentor's own LLM-based scoring:** the
ETS-commissioned "Stumping e-rater" study (Powers et al., 2002) found essays gamed with
strategies invisible to the engine — including **one essay repeating the same paragraph 37 times**
— could still score well; essays using complex sentence structure, sophisticated vocabulary, and
relevant keywords but with faulty logic or off-topic content also scored higher than a trained
human reader would award. A well-documented, still-cited threat class for any NLP/LLM writing
scorer, and **not currently addressed anywhere in the Calibration Brief's Go/No-Go criteria** (see finding 1.5).

**Delivery:** entirely computer-based (paper-based TOEFL PBT discontinued January 2024). Fixed
section order. No live human interviewer — Speaking responses are recorded and scored after the
fact. Score delivery within 72 hours; validity 2 years.

**Grading model:** like IELTS, TOEFL does not double-mark every response by default — it uses a
flagging/escalation model (now AI-driven, rather than IELTS's statistics-driven jagged-profile approach).

**What this means for LinguaMentor specifically:** if 80 "TOEFL Independent Writing" essays were
collected today under the old prompt style, they would not correspond to any task type a current
TOEFL candidate is asked to complete. **Also flag for the AI/ML engineer:** confirm directly with
ETS whether e-rater/SpeechRater have been adapted to the three new task types — this report's
automated-scoring evidence is drawn primarily from the retired task types.

### 2.3 DELF B2 (and the wider DELF/DALF family)

**Governing body:** France Éducation International (FEI) — renamed from CIEP in 2019.

**Format:** 4 independently-scored skills, each /25, total /100. Compréhension de l'oral (30 min)
→ Compréhension des écrits (1h) → Production écrite (1h, ~250-word argumentative essay) as one
collective session; Production orale separately (~20 min: 5–7 min monologue + 10–13 min
debate/interaction), often same day.

**Critical scoring mechanic — pass/fail with a hard per-skill floor, not a banded average.** Need
≥50/100 overall **and** no single skill below 5/25 — a candidate at 60/100 overall with 4/25 on
one skill fails entirely, and must **resit the entire exam** (no partial/per-skill retake, unlike
IELTS's One Skill Retake). **The Readiness Prediction Engine's "band + confidence interval" shape
is the wrong model for DELF** — the useful prediction is P(pass) accounting for the floor
constraint on the candidate's weakest skill, not an aggregate score.

**Product family:** DELF Tous Publics (adults), DELF Prim (ages 7–11), DELF Junior/Scolaire
(teens), DELF Pro (workplace) — same diploma value, different source material. DALF covers C1/C2
(DELF stops at B2).

**Production écrite:** single 1-hour task — argumentative essay, formal letter, or "contribution
to a debate" (forum/reader's-letter style). Core construct: structure/cohesion
(intro–development–conclusion, explicit connectors).

**Production orale:** live, in-person, human-jury format. 5–7 min monologue + 10–13 min
**interactive debate** where the candidate defends their position under real-time challenge from
the examiner. This "defend your position under live adversarial questioning" format has no
equivalent in IELTS or TOEFL Speaking.

**Accent policy:** official FEI documentation states examiners verify comprehensibility,
explicitly accepting pronunciation/intonation may still resemble the candidate's native language.
An official DELF B1 self-assessment document includes the checklist line "my accent does not
hinder comprehension" — same intelligibility-not-native-likeness principle as IELTS.

**Current official scoring grid (in effect since September 2022 — see finding 1.6):** Production
Orale scored on exactly **5 criteria, each on a 4-tier ordinal scale (0/1/3/5 points):** (1) task
realization — monologue, (2) task realization — interaction exercise, (3) lexique, (4)
morphosyntaxe, (5) maîtrise du système phonologique — summing to /25. Production Écrite follows
the same 3-domain structure (pragmatique: task realization + coherence/cohesion; sociolinguistique:
register adequacy; linguistique: lexique + morphosyntaxe) with the same 4-tier mechanic, also /25.
**Special-case rules baked into the grid:** fully off-topic (theme *and* text type) responses zero
3 of 5 criteria outright; thematically off-topic alone caps "réalisation de la tâche" and
"lexique"; under 50% of required word count zeroes the entire exercise; blank submissions zero everything.

**Reform timeline (precise):** researched/prototyped 2019 → finalized March 2022 → deployed from
September 2022, built to ALTE standards, specifically to reduce criteria count and standardize the
grid identically across all 6 CEFR levels. **Any reference material describing DELF/DALF scoring as
fixed continuous per-criterion point weights reflects the pre-2022 grid and is outdated.**

**Marking model — mandatory double-marking, formal habilitation.** Double evaluation is mandatory
for every candidate, every skill, every level — no statistical-sampling shortcut. Examiners hold
an **habilitation** issued by FEI, valid 5 years, requiring Master's-level FLE qualification or
2–3+ years' teaching experience, ~30 hours of training, mandatory group **harmonisation exercises**,
and a final certification test.

**Other reforms:** comprehension sections (Oral + Écrite) moved to 100% multiple-choice,
generalized by 2026.

**Validity:** life-long — no expiry.

### 2.4 DALF C1/C2

**C1 introduces a task type absent at B1/B2 — the mandatory synthesis.** Production écrite C1 =
two linked tasks from a single ~1,000-word, two-document dossier: an objective 200–240 word
**synthesis** (no personal opinion, no outside material) followed by a 250+ word **essai
argumenté** (personal argued position), after 1 hour of prep. A genuinely distinct construct from
DELF B2's single argumentative essay.

**C2 merges comprehension and production entirely** — only two épreuves exist total (écrite, orale),
each blending listening/reading input with production. **There is no separate "comprehension"
grading category at C2 at all** — the PRD's assumption of uniform 4-skill structure across all exam
levels breaks down here.

**2020 reform:** DALF C1's old Sciences vs. Lettres-et-Sciences-Humaines specialty tracks were
merged into a single unified, cross-thematic exam.

**Mechanical, deterministic penalty rules baked directly into the official grid** (more
implementable in an AI rubric layer than IELTS's holistic descriptors): under 50% of required word
count → automatic 0 across all criteria; copying >¾ of source text verbatim (synthesis task) →
automatic 0 on lexical/grammatical competence specifically; exceeding the synthesis word-count
ceiling → candidate cannot be rated "C1"/"C1+" on task-realization. Worth flagging as a place where
≥0.85 correlation may be *more* achievable than for IELTS, since the rules are deterministic.

**Marking model:** same as DELF — mandatory double-marking, two named correctors on the official
grid. Same September 2022 scoring-mechanism reform applies (3-domain structure, 4-tier ordinal
scoring, though exact point ceilings vary by exercise weight).

**Validity:** life-long.

### 2.5 TCF Canada (and the wider TCF family)

**Governing body:** France Éducation International (same body as DELF/DALF, distinct product).

**"TCF Canada" is one of at least three related-but-distinct FEI products** — worth explicit
confirmation this is the intended scope:

- **TCF Canada:** for IRCC (federal economic immigration, citizenship) — 4 *mandatory* modules.
- **TCF Québec:** for MIFI (Quebec-specific immigration/CSQ) — 4 *optional* à-la-carte modules; oral skills weighted especially heavily toward CSQ points (up to 14 of 16 possible points from oral alone).
- **TCF Tout Public:** general A1–C2 certification — mandatory core (Listening/Reading/Structures) plus optional Expression add-ons.

**Format (TCF Canada):** Compréhension Orale (39 MCQ, audio played once), Compréhension Écrite (39
MCQ), Expression Écrite (3 tasks, 60 min total), Expression Orale (3 tasks, separate
interview-style session), ~2h47 total. MCQ sections reportedly use a **"principe de difficulté
progressive"** — items increase in difficulty as the test progresses, described by providers as an
adaptive statistical design — paralleling TOEFL's new multistage-adaptive Reading/Listening.

**Scoring — per-skill NCLC, no combined overall score.** Comprehension tests scored on a raw
~331–699 scale (sources vary; cite ~100–699); Expression tests scored on a raw 4–20 scale. Each
converts independently to **NCLC (Niveaux de Compétence Linguistique Canadiens, 1–12)** via a
published table — the scale IRCC uses directly for Express Entry CRS points. NCLC 7 (≈B2) is the
common minimum for most economic immigration streams. **NCLC is not a rebadged CEFR** — a distinct
scale, different governing body, approximate (not formal) cross-walk to CEFR.

**Marking:** objective MCQ sections scored via automated optical-scan reading against fixed
algorithms. **Written tasks:** each of the 3 Expression Écrite tasks scored independently by **two
FEI-trained correctors in double-blind fashion**; a third corrector adjudicates significant
divergence. **Oral:** recorded live by one certified examiner, independently re-scored by a second
remote corrector.

**Administration:** identity verification and anti-fraud monitoring emphasized throughout
(continuous webcam/ID checks during computer-based sessions) — a different buyer-motivation profile
than DELF B2 given the immigration stakes.

**Validity:** 2 years.

**Competitive landscape:** commercial AI correctors already exist specifically for TCF Canada
(e.g., Preplang, TCFCAD).

### 2.6 TEF Canada

**A separate, competing exam to TCF Canada — not a variant of it.** Administered by CCI Paris
Île-de-France (chamber-of-commerce body), entirely distinct from France Éducation International.
Both TEF Canada and TCF Canada are independently IRCC-accepted for the same immigration programs.
Each has its own separate official score-to-NCLC/CLB conversion table — scores aren't directly
comparable across exams.

**Format — computer-delivered only ("e-TEF"):**

- Compréhension Orale: MCQ, short audio recordings.
- Compréhension Écrite: 50 MCQ across 4 parts.
- **Expression Orale: 2 tasks, face-to-face with a human examiner** — Task A: obtain information from the interlocutor; Task B: **convince/persuade the interlocutor**. This "negotiate and persuade in real time" construct has no direct equivalent in TCF Canada's interview format or DELF's adversarial-debate format.
- Expression Écrite: 2 tasks — Section A (25 min): continue a given article/story, 80 words min; Section B (35 min): express and justify a point of view, 200 words min.

**Retake policy:** all sections in a single sitting; any unsatisfactory score requires **retaking
the entire exam** — no section-level retake (unlike IELTS's One Skill Retake).

**Score appeal:** formal recours process — fixed fee (~€50), ~4-week processing, refunded if the
appeal results in a score revision. Maps closely to the PRD's proposed "Flag → secondary eval →
discrepancy check → admin notify" flow, though the real-world SLA (4 weeks) is far longer than the
PRD's <60s target — worth noting as context for how "fast" is a genuine LinguaMentor differentiator.

**Validity:** 2 years.

---

## 3. Rubric Reference Appendix — Paraphrased Scoring Guidance for Prompt Engineering

**Sourcing caution repeated here for visibility:** every descriptor below is paraphrased and
synthesized from multiple public secondary sources, not copied from official copyrighted
documents. Before shipping into a production prompt, license or access the primary source directly.

### 3.1 IELTS Writing

**Task 1 (Academic) — describing visual/data information.** "Task Achievement" is unique to Task 1.
Top tier (8–9): clearly identifies and prioritizes the most significant features/trends, gives an
explicit overview early, supports every claim with accurate specific figures, no irrelevant
opinion. Mid tier (5–6): overview present but underdeveloped or mechanically listed; some data
inaccurate. Low tier (2–4): minimal/no overview, data misrepresented; responses ≤20 words are
automatically capped at Band 1.

For **General Training Task 1** (a letter): the equivalent criterion checks whether the letter
fulfills its communicative purpose, uses a register appropriate to the specified relationship, and
covers all required bullet points.

**Task 2 — argumentative essay.** Task Response (top): fully developed, clearly stated position
answering every part of the prompt; (bottom): unclear/missing position or off-topic drift.
Coherence & Cohesion (top): effortless logical progression, natural cohesive devices; (bottom): no
organizing logic, mechanical linking. Lexical Resource (top): wide-ranging, precise, idiomatic;
(bottom): limited/basic, frequent meaning-impeding errors. Grammatical Range & Accuracy (top): full
range of structures used flexibly and accurately; (bottom): only basic forms, frequent
meaning-obscuring errors.

**Hard floors regardless of quality elsewhere:** under ~20 words caps Band 1; content entirely
unrelated to the prompt or in a language other than English scores 0.

### 3.2 IELTS Speaking

Same 4-criteria structure across all 3 parts. Fluency & Coherence, Lexical Resource, Grammatical
Range & Accuracy mirror the Writing criteria applied to speech. **Pronunciation** (top): full range
of pronunciation features (intonation, stress, individual sounds, chunking) deployed to convey
precise meaning, effortlessly understood throughout, **regardless of retained L1 accent**; (bottom):
individual sounds frequently unclear, flat delivery, effortful for the listener. **At every tier,
the descriptor explicitly separates accent from intelligibility — a retained accent is never itself
a deduction; only reduced clarity is.**

Overall = arithmetic mean of the four, rounded to nearest 0.5.

### 3.3 TOEFL iBT (2026 format) Writing — three distinct rubrics, not one

**Build a Sentence (binary, no partial credit):** correct requires *both* grammatical accuracy
(subject-verb agreement, word order, modifier placement) *and* semantic appropriateness (logically
answers the contextual prompt); either failure = incorrect (0).

**Write an Email (0–5):** four dimensions — task/goal completion (every bullet point addressed with
real substance), tone/register (correct formality for the specified recipient, proper email
conventions), organization (logical structure for a short functional email), language use
(grammar/vocabulary control). Score 5: every point addressed substantively, consistently
appropriate tone, well-organized. Score 0: blank, off-topic, copied prompt text, wrong language.

**Writing for an Academic Discussion (0–5):** four dimensions — clarity of the candidate's own
position; explicit engagement with at least one classmate's post shown in the prompt (ignoring
classmates and only answering the professor scores lower on this dimension); quality/specificity of
supporting reasoning; grammar/vocabulary control.

The three task scores normalize into the section's 1–6 CEFR-aligned band (Band 5 ≈ C1).

### 3.4 TOEFL iBT (2026 format) Speaking — two tasks, five underlying dimensions

Overall dimensions (per public secondary-source summaries): Fluency, Intelligibility, Language Use,
Organization, Repeat Accuracy — each task draws on a subset.

**Listen and Repeat (7 items):** primarily Fluency, Intelligibility, Repeat Accuracy. Candidate
hears a sentence once (no text shown), reproduces it exactly, 8–12 sec to respond, no prep.

**Take an Interview (4 items):** primarily Fluency, Intelligibility, Language Use, Organization.
Spontaneous questions on a familiar topic, no prep, increasing difficulty.

Both tasks scored primarily by ETS's automated engine, human review only on flagged responses.
Speaking is linear, not adaptive.

### 3.5 DELF B2 — Production Écrite (5 criteria, discrete 4-level grid: 0/1/3/5, 25 total)

Unlike IELTS/TOEFL's continuous scoring, examiners select one of four discrete levels per
criterion: non répondu/insuffisante (0), en dessous du niveau ciblé (1), au niveau B2 (3), B2+ (5).

- **Réalisation de la tâche:** at B2+, fully executes the specific task type with well-developed, relevant content matching the required format; below-target addresses the topic only superficially or uses an inappropriate format/length.
- **Cohérence et cohésion:** at B2+, clear intro/development/conclusion with varied logical connectors used naturally; below-target shows minimal paragraphing.
- **Adéquation sociolinguistique** (no IELTS/TOEFL equivalent): at B2+, register/politeness formulas consistently appropriate to the specified recipient/context; below-target mixes registers inappropriately.
- **Lexique:** at B2+, rich/precise vocabulary for a formal B2 context, repetition avoided; below-target shows a narrow, repetitive, or level-inappropriate vocabulary.
- **Morphosyntaxe:** at B2+, both simple and complex structures controlled with good accuracy; below-target shows frequent basic errors.

**Automatic overrides regardless of linguistic quality:** fully off-topic (theme *and* text type)
zeroes 3 of 5 criteria; thematically off-topic alone caps "réalisation de la tâche" and "lexique";
under 50% of required word count zeroes the entire exercise; blank submission zeroes everything.

### 3.6 DELF B2 — Production Orale (5 criteria, same discrete 0/1/3/5 grid)

Structure: 5–7 min monologue + 10–13 min debate/interaction. Réalisation de la tâche is split and
scored separately for monologue vs. interaction. Lexique/Morphosyntaxe: same descriptors as écrite,
applied to spoken production. **Maîtrise du système phonologique**: at B2+, intonation/rhythm/
individual sound production controlled well enough to support clear communication of nuance;
below-target shows patterns requiring listener effort or obscuring meaning.

Note there is no separately-scored sociolinguistic criterion on the oral grid the way there is on
the written one — pragmatic/sociolinguistic competence is folded into "réalisation de la tâche" for speaking.

### 3.7 TCF Canada — Expression Écrite (3 tasks, 60 min total, scored /20)

- **Tâche 1** (~60–120 words): personal message/email to a specified recipient. Evaluated for clear message communication, all requested info provided, register matching the specified relationship (tu vs. vous).
- **Tâche 2** (~120–150 words): article, letter, or note for multiple readers — recount an experience plus a personal reaction. Evaluated for coherent progression, synthesis/reformulation, register appropriateness.
- **Tâche 3** (~120–180 words): given two documents with opposing viewpoints, first produce a balanced objective summary, then argue a clear personal position with concrete support.

**Cross-task criteria:** a linguistic dimension (vocabulary range/precision, grammatical/spelling
accuracy, sentence elaboration) and a pragmatic/coherence dimension (logical organization,
synthesis/reformulation ability, situational adaptation). **Word-count and completion are hard
gates:** falling short of minimum word count, illegible writing, off-topic content, or skipping a
task results in that task scored "level not attained" (reported below A1).

### 3.8 TCF Canada — Expression Orale (3 tasks, scored /20)

- **Tâche 1** (~2 min): unprepared directed interview on personal/everyday topics.
- **Tâche 2**: interactive exercise with brief prep — typically obtaining information in an everyday scenario.
- **Tâche 3**: extended argumentative discussion — give an opinion, weigh advantages/disadvantages, structure a developed argument in a context-appropriate register.

**Grading criteria** mirror the written test: a linguistic dimension (vocabulary richness/precision,
grammatical correctness, fluency, pronunciation), a pragmatic dimension (interaction capacity,
discourse coherence), and a situational-adequacy dimension (register appropriate to the specified
interlocutor/context).

### 3.9 Cross-exam criterion mapping (for a unified internal schema)

| LinguaMentor internal dimension | IELTS | TOEFL 2026 | DELF B2 | TCF Canada |
|---|---|---|---|---|
| Task fulfillment | Task Response / Task Achievement | Goal completion (Email) / Position+engagement (Discussion) | Réalisation de la tâche | Task-specific content (implicit, within pragmatic dimension) |
| Organization/coherence | Coherence & Cohesion | Organization | Cohérence et cohésion | Coherence/synthesis (pragmatic dimension) |
| **Register/social appropriateness** | *(not separately scored — folded into Task Response for GT letters)* | Tone/register (Email) | **Adéquation sociolinguistique** (explicit, separate) | Situational adequacy (explicit, separate) |
| Vocabulary | Lexical Resource | Language Use (shared with grammar) | Lexique | Linguistic — lexical richness |
| Grammar | Grammatical Range & Accuracy | Language Use (shared with vocabulary) | Morphosyntaxe | Linguistic — grammatical correctness |
| Pronunciation/phonology (speaking only) | Pronunciation | Intelligibility / Repeat Accuracy | Maîtrise du système phonologique | Linguistic — pronunciation (oral only) |

**The one dimension three of four exams score explicitly and separately, but IELTS folds into
another criterion:** register/social appropriateness (see finding 1.12). If the rubric-injection
schema has no distinct register/sociolinguistic slot, this is the single highest-value addition to
make one shared schema fit DELF and TCF as well as it fits IELTS/TOEFL.

---

## 4. Recommended Actions Mapped to PRD/Calibration Brief Sections

| PRD/Brief section | Issue found | Suggested action |
|---|---|---|
| Calibration Brief §2.1 (TOEFL row) | Retired Integrated/Independent task types and "14–30" range | Update to current 3-task Writing format and 1.0–6.0 band scale — see §5.1 |
| Calibration Brief §2.2 | No TEF Canada line | Add TEF Canada as a distinct calibration target with its own sample set |
| Calibration Brief Go/No-Go | "≥90% CEFR accuracy" ignores IELTS-CEFR boundary fuzziness | Define accuracy with tolerance near CEFR boundaries, or use a boundary-aware metric |
| Calibration Brief Go/No-Go | **No adversarial/gaming-resistance testing** (1.5) | Add a bad-faith/adversarial sample set to Go/No-Go — precedent: "Stumping e-rater" |
| Calibration Brief §3 | "CIEP-accredited" outdated; correct term is FEI *habilitation* (5-year cycle) | Update terminology |
| Calibration Brief scope | "TCF Canada" doesn't distinguish from Québec/Tout Public | Confirm TCF Canada specifically; document the distinction |
| Master PRD data model | Doesn't accommodate NCLC output or DELF's pass/fail-with-floor | Add NCLC output field; add a P(pass)-with-floor model — see §5.2, §5.3 |
| Readiness Prediction Engine | Single "band + CI" assumed universal | Branch by exam type — see §5.3 |
| Exam Simulation Engine | Per-section timing only; no sub-task/adaptive difficulty | Add per-task timer granularity for TCF/TEF and new TOEFL; decide on adaptive delivery |
| Voice Agent / accent_target | Framed as modeling real exam pronunciation scoring | State explicitly that accent-relative scoring is a deliberate engineering choice |
| Phase 0 examiner redundancy | "≥2 examiners" grounded for DELF/DALF/TCF; IELTS is single + flagging | State the distinction; note IELTS's flagging model is close precedent for our Score Appeal Flow |
| AI Orchestration — output schema | Free continuous scores; real DELF/DALF is 4-tier ordinal | For French exams, redesign schema as classify-then-convert — see §5.2 / finding 1.6 |
| AI Orchestration — rubric schema | No distinct register/sociolinguistic dimension | Add register/sociolinguistic adequacy as its own criterion — see §3.9 |
| AI Orchestration | No existing-precedent review for e-rater/SpeechRater | Review ETS's published e-rater research as the closest prior art |
| Score Appeal Flow | <60s target with no external benchmark | Real equivalents run multi-week SLAs; confirm <60s is understood as a differentiator |
| Product messaging | Assumes uniform credential expiry | DELF/DALF are lifetime-valid; others are 2-year |

---

## 5. Proposed Replacement Language — Priority Items

Drafted as close to drop-in-ready as possible. Treat as a strong first draft for the team to adapt
to actual schema/field names, not a verified final diff.

### 5.1 Calibration Brief §2.1 — Writing Calibration Scope (TOEFL row)

**Proposed replacement:**

| Exam | Task Type | Sample Requirement |
|---|---|---|
| TOEFL iBT (current format, effective January 21, 2026) | Build a Sentence · Write an Email · Writing for an Academic Discussion | Minimum 80 responses, distributed across all three task types (recommend ≥25 per task type given their distinct scoring constructs) · Score reported on the new 1.0–6.0 CEFR-aligned band, alongside the legacy 0–120 total during the 2026–2028 dual-reporting transition |

**Supplementary note:** ETS retired the two-task Writing section on January 21, 2026, replacing it
with three shorter tasks. Because each new task type is scored on a distinct construct,
rubric-tuning should run per task type rather than treating "TOEFL Writing" as one homogeneous
construct. Any essay samples already collected against the old task types should not be used as
Phase 0 calibration data. **Also flag for the AI/ML engineer:** confirm with ETS whether
e-rater/SpeechRater have been adapted to the three new task types.

### 5.2 Master PRD — NCLC Output Requirement for TCF Canada / TEF Canada

**Gap:** the current data model reports proficiency exclusively in CEFR terms. TCF/TEF Canada
learners actually need an **NCLC level per skill (1–12)** for their IRCC application.

**Proposed new subsection (Data Layer, near ReadinessSnapshot / AIModelRun):**

*For learners on the TCF Canada or TEF Canada exam tracks, compute and display an NCLC-equivalent
level (1–12) per skill — compréhension orale, compréhension écrite, expression écrite, expression
orale — in addition to (not instead of) the standard CEFR classification.*

- *`nclc_conversion_version`: versioned, immutable reference to the specific official conversion table in use, analogous to `calibration_version`. **TCF Canada and TEF Canada require separate conversion tables** (different administering bodies) — do not apply a single shared table across both.*
- *`nclc_per_skill`: JSON object, one integer (1–12) per skill, computed via the correct exam-specific table from that exam's own raw scale.*
- *The learner-facing dashboard/PDF report for TCF/TEF Canada should surface NCLC-per-skill (with a visual marker for the common NCLC 7 Express Entry threshold) as the primary metric, CEFR as secondary.*
- *Does **not** apply to IELTS, TOEFL, DELF, or DALF — continue CEFR-only reporting there.*

### 5.3 Master PRD — Readiness Prediction Engine: Branch by Exam Scoring Shape

**Proposed replacement/addition — Readiness Model Selection by Exam Type:**

*The Readiness Prediction Engine must select one of three output models based on the learner's
active exam type:*

- ***Model A — Banded Average (IELTS, TOEFL):*** existing design — weighted skill aggregation, trend factor, projected band with confidence interval, daily delta. No per-section floor.
- ***Model B — Floor-Constrained Pass Probability (DELF, DALF):*** requires ≥50/100 overall **and** no single skill below 5/25 — either failure is an outright fail. Report **P(pass)**, computed from per-skill score distributions with the floor constraint modeled explicitly (e.g., Monte Carlo over each skill's distribution, computing the joint probability that the total clears 50 *and* every skill clears 5). Surface the **weakest skill's floor-clearance probability** as the primary risk driver. For DALF C2, recompute the floor logic at the paper level (écrite, orale), not as four independent skills.
- ***Model C — Per-Skill NCLC Projection (TCF Canada, TEF Canada):*** no combined "overall" score exists in the source exam. Report a **per-skill NCLC projection with its own confidence interval**; organize the dashboard around progress toward a target NCLC per skill (commonly NCLC 7). Consumes the NCLC Output Layer in §5.2.

*Model selection is driven by `exam_type` at Exam Track setup, and determines both the computation
path and the downstream dashboard/report component shape.*

### 5.4 Calibration Brief §6 — Add Adversarial/Gaming-Resistance Testing to Go/No-Go Criteria

**Proposed addition — Adversarial Sample Testing:**

*In addition to the correlation and WER targets, Phase 0 must include a bad-faith adversarial test
set per exam type — responses deliberately constructed to exploit likely scoring shortcuts (e.g.,
keyword stuffing, paragraph repetition, memorized-template structures, topic-relevant vocabulary
wrapped around logically empty or off-topic content). The AI scorer must not systematically
over-score this set relative to a human examiner's judgment. This is a known, decades-documented
vulnerability class (see ETS's "Stumping e-rater," Powers et al., 2002) and should be a hard gate
alongside the Pearson correlation target, not an optional/later addition.*

---

## 6. Open Questions for a Follow-Up Pass

- Whether Québécois-accented French is treated identically to Metropolitan French under TCF/TEF Canada's official grading — the general intelligibility principle almost certainly extends here, but no document explicitly named this case.
- Confirmation, from ETS directly, of whether SpeechRater/e-rater are used in the *new* (post-Jan-2026) TOEFL task types or only the legacy ones.
- Whether DALF C1 synthesis/essay criteria received the same 3-domain, 4-tier restructuring confirmed for DELF B2 and DALF C2, or retain a different point structure.
- Direct primary-source verification of the TOEFL Technical Manual's 0.89/0.96 Speaking correlation figures (currently via third-party summary).
- Full current TCF Québec and TCF Tout Public module/scoring detail, if either becomes relevant to product scope beyond TCF Canada.

*End of document.*
