"""Phase 0 calibration harness (Calibration Brief §6, Master PRD §60).

Runs the Writing Evaluation Engine over a human-graded essay dataset and
computes Pearson correlation — overall and per rubric category — against the
Go/No-Go gates:

    overall  >= 0.85   hard gate
    category >= 0.80   soft gate (flags the category for rubric tuning)

Dataset format: JSONL, one essay per line:
    {"essay_id": "...", "exam_type": "ielts_academic",
     "prompt_text": "...", "essay_text": "...",
     "human_overall": 6.5,
     "human_categories": {"task_response": 6.0, ...}}

`human_overall` is the two-examiner consensus score (Brief §6.1); essays
failing inter-rater reliability must be excluded *before* they reach this
file. Always re-run against the full dataset after rubric tuning — never a
subset (Brief §6.2 warning).
"""

import asyncio
import json
import statistics
from dataclasses import dataclass, field
from decimal import Decimal
from pathlib import Path

from pydantic import BaseModel

from app.engines.writing_evaluation import evaluate_essay
from app.providers.llm.base import LLMProvider

OVERALL_GATE = 0.85
CATEGORY_GATE = 0.80
# Brief §6.2 step 2: essays where AI and human diverge by more than a full
# band are the tuning-loop review set.
DIVERGENCE_THRESHOLD = Decimal("1.0")


class CalibrationEssay(BaseModel):
    essay_id: str
    exam_type: str
    prompt_text: str
    essay_text: str
    human_overall: Decimal
    human_categories: dict[str, Decimal]


@dataclass
class EssayScore:
    essay_id: str
    human_overall: Decimal
    ai_overall: Decimal
    human_categories: dict[str, Decimal]
    ai_categories: dict[str, Decimal]

    @property
    def delta(self) -> Decimal:
        return abs(self.ai_overall - self.human_overall)


@dataclass
class CalibrationReport:
    exam_type: str
    sample_count: int
    failed_count: int
    overall_pearson: float
    category_pearson: dict[str, float]
    divergent_essays: list[dict] = field(default_factory=list)

    @property
    def overall_gate_passed(self) -> bool:
        return self.overall_pearson >= OVERALL_GATE

    @property
    def categories_below_gate(self) -> list[str]:
        return sorted(
            key for key, r in self.category_pearson.items() if r < CATEGORY_GATE
        )

    def to_dict(self) -> dict:
        return {
            "exam_type": self.exam_type,
            "sample_count": self.sample_count,
            "failed_count": self.failed_count,
            "overall_pearson": round(self.overall_pearson, 4),
            "overall_gate": OVERALL_GATE,
            "overall_gate_passed": self.overall_gate_passed,
            "category_pearson": {k: round(v, 4) for k, v in self.category_pearson.items()},
            "category_gate": CATEGORY_GATE,
            "categories_below_gate": self.categories_below_gate,
            "divergent_essays": self.divergent_essays,
        }


def load_dataset(path: Path) -> list[CalibrationEssay]:
    essays = []
    with path.open() as f:
        for line_number, line in enumerate(f, start=1):
            if not line.strip():
                continue
            try:
                essays.append(CalibrationEssay.model_validate(json.loads(line)))
            except Exception as exc:  # noqa: BLE001 — surface the line number
                raise ValueError(f"{path}:{line_number}: invalid essay record: {exc}") from exc
    return essays


def pearson(xs: list[float], ys: list[float]) -> float:
    """Pearson r via stdlib. Needs >= 2 points and nonzero variance."""
    if len(xs) < 2:
        raise ValueError("Pearson correlation needs at least 2 samples")
    return statistics.correlation(xs, ys)


async def score_dataset(
    provider: LLMProvider,
    essays: list[CalibrationEssay],
    *,
    model: str,
    concurrency: int = 4,
) -> tuple[list[EssayScore], list[dict]]:
    """Score every essay; collect failures instead of aborting the run —
    a 100-essay run shouldn't die at essay 97."""
    semaphore = asyncio.Semaphore(concurrency)
    failures: list[dict] = []

    async def score_one(essay: CalibrationEssay) -> EssayScore | None:
        async with semaphore:
            try:
                result = await evaluate_essay(
                    provider,
                    exam_type=essay.exam_type,
                    prompt_text=essay.prompt_text,
                    essay_text=essay.essay_text,
                    model=model,
                )
            except Exception as exc:  # noqa: BLE001 — recorded per essay
                failures.append({"essay_id": essay.essay_id, "error": str(exc)})
                return None
        return EssayScore(
            essay_id=essay.essay_id,
            human_overall=essay.human_overall,
            ai_overall=result.overall_band_score,
            human_categories=essay.human_categories,
            ai_categories={c.key: c.score for c in result.categories},
        )

    scored = await asyncio.gather(*(score_one(e) for e in essays))
    return [s for s in scored if s is not None], failures


def build_report(exam_type: str, scores: list[EssayScore], failed_count: int) -> CalibrationReport:
    overall = pearson(
        [float(s.human_overall) for s in scores],
        [float(s.ai_overall) for s in scores],
    )
    category_keys = sorted(scores[0].ai_categories) if scores else []
    category_pearson = {}
    for key in category_keys:
        pairs = [
            (float(s.human_categories[key]), float(s.ai_categories[key]))
            for s in scores
            if key in s.human_categories
        ]
        if len(pairs) >= 2:
            category_pearson[key] = pearson([p[0] for p in pairs], [p[1] for p in pairs])

    divergent = sorted(
        (s for s in scores if s.delta > DIVERGENCE_THRESHOLD),
        key=lambda s: s.delta,
        reverse=True,
    )
    return CalibrationReport(
        exam_type=exam_type,
        sample_count=len(scores),
        failed_count=failed_count,
        overall_pearson=overall,
        category_pearson=category_pearson,
        divergent_essays=[
            {
                "essay_id": s.essay_id,
                "human": str(s.human_overall),
                "ai": str(s.ai_overall),
                "delta": str(s.delta),
            }
            for s in divergent
        ],
    )


async def run_calibration(
    provider: LLMProvider,
    dataset_path: Path,
    *,
    model: str,
    concurrency: int = 4,
) -> list[CalibrationReport]:
    """One report per exam_type present in the dataset (gates apply per exam
    type — Brief §9: a partial pass is a no-go)."""
    essays = load_dataset(dataset_path)
    reports = []
    for exam_type in sorted({e.exam_type for e in essays}):
        subset = [e for e in essays if e.exam_type == exam_type]
        scores, failures = await score_dataset(
            provider, subset, model=model, concurrency=concurrency
        )
        reports.append(build_report(exam_type, scores, len(failures)))
    return reports
