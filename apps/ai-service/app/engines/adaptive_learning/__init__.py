"""Adaptive Learning Engine (Master PRD §23) — public surface.

Phase 1 implements skill-level SRS only; weakness detection (§23.2) and the
skill-vector update loop (§23.1) land with the sessions that feed them.
"""

from app.engines.adaptive_learning.daily_session import (
    DAILY_SESSION_MAX_TOKENS,
    DAILY_SESSION_TEMPERATURE,
    DailySessionError,
    DailySessionResult,
    Exercise,
    SessionContent,
    build_daily_session_messages,
    generate_daily_session,
    parse_session_content,
)
from app.engines.adaptive_learning.srs import (
    MAX_INTERVAL_DAYS,
    MIN_INTERVAL_DAYS,
    SCHEDULABLE_DIMENSIONS,
    DimensionPriority,
    DimensionState,
    compute_priority,
    next_interval,
    rank_dimensions,
    volatility_factor,
)

__all__ = [
    "DAILY_SESSION_MAX_TOKENS",
    "DAILY_SESSION_TEMPERATURE",
    "DailySessionError",
    "DailySessionResult",
    "Exercise",
    "MAX_INTERVAL_DAYS",
    "MIN_INTERVAL_DAYS",
    "SCHEDULABLE_DIMENSIONS",
    "DimensionPriority",
    "DimensionState",
    "SessionContent",
    "build_daily_session_messages",
    "compute_priority",
    "generate_daily_session",
    "next_interval",
    "parse_session_content",
    "rank_dimensions",
    "volatility_factor",
]
