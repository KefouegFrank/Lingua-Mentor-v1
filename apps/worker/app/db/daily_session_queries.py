"""asyncpg queries for the daily micro-session batch (ADR 0009 §2.2)."""

from datetime import date
from uuid import UUID

import asyncpg


async def list_active_learners(
    conn: asyncpg.Connection, *, active_within_days: int
) -> list[asyncpg.Record]:
    """Learners worth spending an inference on ahead of tomorrow.

    `last_active_at` is written on refresh as well as login — opening the app
    never logs in, so `last_login_at` would miss the most engaged learners.
    """
    return await conn.fetch(
        """
        SELECT lp.id AS learner_profile_id
        FROM learner_profiles lp
        JOIN users u ON u.id = lp.user_id
        WHERE u.is_active = true
          AND u.gdpr_erasure_requested_at IS NULL
          AND u.last_active_at IS NOT NULL
          AND u.last_active_at > now() - make_interval(days => $1)
        ORDER BY lp.id
        """,
        active_within_days,
    )


async def session_exists(
    conn: asyncpg.Connection, learner_profile_id: UUID, session_date: date
) -> bool:
    """Whether today is already claimed — checked before generating, so the
    batch never pays for a session the learner triggered themselves."""
    return await conn.fetchval(
        """
        SELECT EXISTS (
            SELECT 1 FROM daily_sessions
            WHERE learner_profile_id = $1 AND session_date = $2
        )
        """,
        learner_profile_id,
        session_date,
    )
