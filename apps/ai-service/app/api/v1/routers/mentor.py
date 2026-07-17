"""AI Mentor routes — mounted under /api/v1/mentor.

Phase 1 exposes the Daily Diagnostic Micro-Session (PRD §36
`POST /mentor/daily-diagnostic`): SRS picks the skill, the mentor turns it into
five minutes of drill. Internal surface — the gateway is the user-facing caller
and owns the §33 cache.
"""

import uuid
from datetime import UTC, datetime

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.v1.deps import get_db, get_llm_provider
from app.core.config import get_settings
from app.db.repositories import (
    daily_session_repository,
    model_run_repository,
    skill_vector_repository,
    user_repository,
)
from app.engines.adaptive_learning import (
    SCHEDULABLE_DIMENSIONS,
    DimensionState,
    SessionContent,
    generate_daily_session,
    rank_dimensions,
)
from app.providers.llm.base import LLMProvider

router = APIRouter(prefix="/mentor", tags=["mentor"])


class DailyDiagnosticRequest(BaseModel):
    learner_profile_id: uuid.UUID


class DailyDiagnosticResponse(BaseModel):
    """PRD §35.3's shape. `readiness_before` is absent until the Readiness
    Engine exists in Phase 4 — a fabricated one would be worse (ADR 0009 §2.5).
    """

    session_id: uuid.UUID
    session_date: str
    skill_targeted: str
    srs_priority_score: float
    session_content: SessionContent
    pre_session_score: float
    # True when this call generated it; False when today's already existed.
    generated: bool


def _states(row: asyncpg.Record) -> list[DimensionState]:
    return [
        DimensionState(
            dimension=dim,
            score=float(row[f"{dim}_score"]),
            last_practiced_at=row[f"{dim}_last_practiced"],
            interval_days=row[f"{dim}_srs_interval"],
        )
        for dim in SCHEDULABLE_DIMENSIONS
    ]


@router.post("/daily-diagnostic", response_model=DailyDiagnosticResponse)
async def daily_diagnostic(
    body: DailyDiagnosticRequest,
    conn: asyncpg.Connection = Depends(get_db),
    provider: LLMProvider = Depends(get_llm_provider),
) -> DailyDiagnosticResponse:
    settings = get_settings()
    profile = await user_repository.get_learner_profile(conn, body.learner_profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="learner profile not found")

    language = profile["target_language"]
    vector = await skill_vector_repository.get_skill_vector(
        conn, body.learner_profile_id, language
    )
    if vector is None:
        vector = await skill_vector_repository.create_skill_vector(
            conn, body.learner_profile_id, language
        )

    history = await skill_vector_repository.get_recent_dimension_scores(
        conn, body.learner_profile_id
    )
    top = rank_dimensions(_states(vector), recent_scores=history)[0]

    # The UTC calendar day, not "24h ago" — the boundary §23.3 names (ADR 0009 §2.1).
    session_date = datetime.now(UTC).date()
    pre_session_score = float(vector[f"{top.dimension}_score"])

    tier = await user_repository.get_subscription_tier(conn, body.learner_profile_id) or "free"
    result = await generate_daily_session(
        provider,
        dimension=top.dimension,
        persona=profile["default_persona"],
        tier=tier,
        language=language,
        model=settings.llm_model_mid_tier,
        cefr_level=profile["cefr_writing"],
        target_exam=profile["target_exam"],
    )

    run_id = await model_run_repository.insert_run(
        conn,
        session_id=uuid.uuid4(),
        session_type="daily_session",
        task_type="daily_diagnostic",
        provider=result.response.provider,
        model_name=result.response.model_name,
        model_version=result.response.model_version,
        prompt_hash=result.prompt_hash,
        response_hash=result.response.response_hash,
        input_token_count=result.response.input_token_count,
        output_token_count=result.response.output_token_count,
        latency_ms=result.response.latency_ms,
        # §11.5 wants the persona on the run: the drill's tone came from it.
        persona_config={"persona": profile["default_persona"], "tier": tier},
    )

    row = await daily_session_repository.insert_session(
        conn,
        learner_profile_id=body.learner_profile_id,
        session_date=session_date,
        skill_targeted=top.dimension,
        srs_priority_score=top.priority,
        pre_session_score=pre_session_score,
        ai_model_run_id=run_id,
    )
    generated = row is not None
    if row is None:
        # Someone else claimed today between the SRS read and the insert; their
        # row is the session, and the drill just generated is discarded.
        row = await daily_session_repository.get_for_date(
            conn, body.learner_profile_id, session_date
        )
        if row is None:
            raise HTTPException(status_code=409, detail="daily session vanished mid-write")

    return DailyDiagnosticResponse(
        session_id=row["id"],
        session_date=session_date.isoformat(),
        skill_targeted=row["skill_targeted"],
        srs_priority_score=float(row["srs_priority_score"]),
        session_content=result.content,
        pre_session_score=float(row["pre_session_score"]),
        generated=generated,
    )
