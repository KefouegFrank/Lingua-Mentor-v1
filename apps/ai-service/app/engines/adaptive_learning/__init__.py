"""Adaptive Learning Engine (Master PRD §23) — public surface.

Phase 1 implements skill-level SRS only; weakness detection (§23.2) and the
skill-vector update loop (§23.1) land with the sessions that feed them.
"""

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
    "MAX_INTERVAL_DAYS",
    "MIN_INTERVAL_DAYS",
    "SCHEDULABLE_DIMENSIONS",
    "DimensionPriority",
    "DimensionState",
    "compute_priority",
    "next_interval",
    "rank_dimensions",
    "volatility_factor",
]
