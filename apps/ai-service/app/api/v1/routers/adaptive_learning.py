"""Adaptive Learning routes — mounted under /api/v1/adaptive.

Phase 1 exposes SRS scheduling only (PRD §36, `GET /adaptive/srs-next`): given a
learner's skill vector, which dimension has decayed enough to be worth the next
session. Internal surface — the gateway is the user-facing caller.
"""

import uuid

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.api.v1.deps import get_db
from app.db.repositories import skill_vector_repository, user_repository
from app.engines.adaptive_learning import (
    SCHEDULABLE_DIMENSIONS,
    DimensionState,
    rank_dimensions,
)

router = APIRouter(prefix="/adaptive", tags=["adaptive"])


class DimensionPriorityOut(BaseModel):
    dimension: str
    priority: float
    overdue_ratio: float
    skill_gap: float
    volatility: float
    days_since_practice: float | None
    interval_days: int


class SrsScheduleResponse(BaseModel):
    learner_profile_id: uuid.UUID
    language: str
    # The dimension to practise next — what the daily session builds on (§23.3).
    next_dimension: str
    next_priority: float
    schedule: list[DimensionPriorityOut]


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


@router.get("/srs-next", response_model=SrsScheduleResponse)
async def get_srs_next(
    learner_profile_id: uuid.UUID,
    language: str | None = Query(default=None),
    conn: asyncpg.Connection = Depends(get_db),
) -> SrsScheduleResponse:
    """Rank the learner's schedulable dimensions, most urgent first."""
    profile = await user_repository.get_learner_profile(conn, learner_profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="learner profile not found")

    # One vector per language (schema); default to what the learner is studying.
    resolved_language = language or profile["target_language"]
    row = await skill_vector_repository.get_skill_vector(
        conn, learner_profile_id, resolved_language
    )
    if row is None:
        # First schedule for this learner — seed at the schema's 0.5 defaults
        # rather than 404, so a fresh account gets a schedule immediately.
        row = await skill_vector_repository.create_skill_vector(
            conn, learner_profile_id, resolved_language
        )

    history = await skill_vector_repository.get_recent_dimension_scores(conn, learner_profile_id)
    ranked = rank_dimensions(_states(row), recent_scores=history)

    return SrsScheduleResponse(
        learner_profile_id=learner_profile_id,
        language=resolved_language,
        next_dimension=ranked[0].dimension,
        next_priority=ranked[0].priority,
        schedule=[DimensionPriorityOut(**vars(p)) for p in ranked],
    )
