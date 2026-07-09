"""Writing evaluation routes — mounted under /api/v1/writing-eval.

Internal surface: callers are the background worker (scoring jobs) and the
Phase 0 calibration harness — not browsers. Every call logs an AIModelRun
row before returning (PRD §28.2: no evaluation result exists without a
traceable AI execution record).
"""

import uuid
from decimal import Decimal

import asyncpg
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.v1.deps import get_db, get_llm_provider
from app.core.config import get_settings
from app.db.repositories import calibration_repository, model_run_repository
from app.engines.writing_evaluation import WritingEvaluationResult, evaluate_essay
from app.providers.llm.base import LLMProvider

router = APIRouter(prefix="/writing-eval", tags=["writing-eval"])


class EvaluateRequest(BaseModel):
    exam_type: str
    prompt_text: str = Field(min_length=1)
    essay_text: str = Field(min_length=1)
    # When the worker scores a stored session it passes the session's id so
    # the AIModelRun row ties back to it; the calibration harness omits it.
    session_id: uuid.UUID | None = None
    session_type: str = "calibration"
    target_band: str | None = None
    cefr_writing: str | None = None
    calibration_version: str | None = None


class EvaluateResponse(WritingEvaluationResult):
    ai_model_run_id: uuid.UUID


@router.post("/evaluate", response_model=EvaluateResponse)
async def evaluate(
    body: EvaluateRequest,
    conn: asyncpg.Connection = Depends(get_db),
    provider: LLMProvider = Depends(get_llm_provider),
) -> EvaluateResponse:
    settings = get_settings()
    # A user-facing score must carry the calibration it was produced under
    # (PRD §21.3). The worker never sends a version — it's resolved here from
    # the active baseline for the exam. Calibration harness runs are exempt:
    # they generate the very data a baseline is built from, so there's nothing
    # to cite yet (session_type == "calibration" marks them). No active baseline
    # leaves the version NULL — an honest "uncalibrated" marker the display
    # layer gates on, rather than a score silently presented as calibrated.
    calibration_version = body.calibration_version
    if calibration_version is None and body.session_type != "calibration":
        baseline = await calibration_repository.get_active_baseline(conn, body.exam_type)
        calibration_version = baseline["calibration_version"] if baseline else None
    result = await evaluate_essay(
        provider,
        exam_type=body.exam_type,
        prompt_text=body.prompt_text,
        essay_text=body.essay_text,
        model=settings.llm_model_high_tier,
        target_band=body.target_band,
        cefr_writing=body.cefr_writing,
        calibration_version=calibration_version,
    )
    run_id = await model_run_repository.insert_run(
        conn,
        session_id=body.session_id or uuid.uuid4(),
        session_type=body.session_type,
        task_type="writing_scoring",
        provider=result.provider,
        model_name=result.model_name,
        model_version=result.model_version,
        prompt_hash=result.prompt_hash,
        response_hash=result.response_hash,
        input_token_count=result.input_token_count,
        output_token_count=result.output_token_count,
        latency_ms=result.latency_ms,
        was_fallback=result.was_fallback,
        calibration_version=result.calibration_version,
    )
    return EvaluateResponse(**result.model_dump(), ai_model_run_id=run_id)


class CategoryPreview(BaseModel):
    key: str
    name: str
    weight: Decimal


class ExamPreview(BaseModel):
    exam_id: str
    display_name: str
    language: str
    task_name: str
    categories: list[CategoryPreview]


@router.get("/exams", response_model=list[ExamPreview])
async def list_exams() -> list[ExamPreview]:
    """Rubric metadata for supported exams — used by the frontend to render
    breakdown skeletons without hardcoding category names."""
    from app.engines.writing_evaluation.exam_config import EXAMS_DIR, load_exam_config

    previews = []
    for path in sorted(EXAMS_DIR.glob("*.yaml")):
        config = load_exam_config(path.stem)
        previews.append(
            ExamPreview(
                exam_id=config.exam_id,
                display_name=config.display_name,
                language=config.language,
                task_name=config.writing.task_name,
                categories=[
                    CategoryPreview(key=c.key, name=c.name, weight=c.weight)
                    for c in config.writing.rubric_categories
                ],
            )
        )
    return previews
