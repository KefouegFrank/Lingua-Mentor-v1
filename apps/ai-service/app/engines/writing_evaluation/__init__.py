"""Writing Evaluation Engine (Master PRD §21) — public surface."""

from app.engines.writing_evaluation.engine import (
    APPEAL_TEMPERATURE,
    EvaluationError,
    compute_overall_band,
    evaluate_essay,
)
from app.engines.writing_evaluation.exam_config import (
    PlacementUnavailableError,
    UnknownExamError,
    load_exam_config,
    load_placement_task,
)
from app.engines.writing_evaluation.schemas import WritingEvaluationResult

__all__ = [
    "APPEAL_TEMPERATURE",
    "EvaluationError",
    "PlacementUnavailableError",
    "UnknownExamError",
    "WritingEvaluationResult",
    "compute_overall_band",
    "evaluate_essay",
    "load_exam_config",
    "load_placement_task",
]
