"""asyncpg queries for daily_sessions — the §15.2 retention loop's record.

The generated drill itself is not stored here: `daily_sessions` has no content
column by design (PRD §33 caches it in Redis). This table records *that* a
session existed, what it targeted, and which inference produced it.
"""

from datetime import date
from uuid import UUID

import asyncpg


async def get_for_date(
    conn: asyncpg.Connection, learner_profile_id: UUID, session_date: date
) -> asyncpg.Record | None:
    return await conn.fetchrow(
        """
        SELECT id, learner_profile_id, session_date, skill_targeted, srs_priority_score,
               pre_session_score, completed_at, created_at
        FROM daily_sessions
        WHERE learner_profile_id = $1 AND session_date = $2
        """,
        learner_profile_id,
        session_date,
    )


async def insert_session(
    conn: asyncpg.Connection,
    *,
    learner_profile_id: UUID,
    session_date: date,
    skill_targeted: str,
    srs_priority_score: float,
    pre_session_score: float,
    ai_model_run_id: UUID,
) -> asyncpg.Record | None:
    """Claim today's session for this learner.

    Returns None when one already exists: the unique constraint makes the batch
    and an on-demand request converge rather than race into two rows, and the
    loser reads the winner's (ADR 0009 §2.4).
    """
    return await conn.fetchrow(
        """
        INSERT INTO daily_sessions (
            learner_profile_id, session_date, skill_targeted, srs_priority_score,
            pre_session_score, ai_model_run_id
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT ON CONSTRAINT uq_daily_sessions_learner_date DO NOTHING
        RETURNING id, learner_profile_id, session_date, skill_targeted, srs_priority_score,
                  pre_session_score, completed_at, created_at
        """,
        learner_profile_id,
        session_date,
        skill_targeted,
        srs_priority_score,
        pre_session_score,
        ai_model_run_id,
    )


async def list_active_learners(
    conn: asyncpg.Connection, *, active_within_days: int
) -> list[asyncpg.Record]:
    """Learners worth pre-generating for (ADR 0009 §2.2).

    Keyed off `last_active_at` — written on refresh as well as login, because
    opening the app never logs in. NULL means never opened since that column
    shipped, which is not a learner to spend an inference on.
    """
    return await conn.fetch(
        """
        SELECT lp.id AS learner_profile_id, lp.target_language
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
