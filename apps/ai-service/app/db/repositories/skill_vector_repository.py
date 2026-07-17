"""asyncpg queries for skill_vectors — SRS state per dimension (PRD §23.3)."""

from uuid import UUID

import asyncpg

from app.engines.adaptive_learning import SCHEDULABLE_DIMENSIONS


async def get_skill_vector(
    conn: asyncpg.Connection, learner_profile_id: UUID, language: str
) -> asyncpg.Record | None:
    """The learner's vector for one language — EN and FR are tracked apart."""
    return await conn.fetchrow(
        """
        SELECT id, learner_profile_id, language,
               grammar_score, grammar_last_practiced, grammar_srs_interval,
               vocabulary_score, vocabulary_last_practiced, vocabulary_srs_interval,
               coherence_score, coherence_last_practiced, coherence_srs_interval,
               pronunciation_score, pronunciation_last_practiced, pronunciation_srs_interval,
               fluency_score, fluency_last_practiced, fluency_srs_interval,
               comprehension_score, updated_at
        FROM skill_vectors
        WHERE learner_profile_id = $1 AND language = $2
        """,
        learner_profile_id,
        language,
    )


async def create_skill_vector(
    conn: asyncpg.Connection, learner_profile_id: UUID, language: str
) -> asyncpg.Record:
    """Seed a vector at the schema's 0.5 defaults, or return the existing one.

    A learner has no vector until something schedules them; ON CONFLICT keeps
    two concurrent first-reads from racing into a unique violation.
    """
    await conn.execute(
        """
        INSERT INTO skill_vectors (learner_profile_id, language)
        VALUES ($1, $2)
        ON CONFLICT (learner_profile_id, language) DO NOTHING
        """,
        learner_profile_id,
        language,
    )
    row = await get_skill_vector(conn, learner_profile_id, language)
    assert row is not None  # the INSERT above guarantees it
    return row


async def get_recent_dimension_scores(
    conn: asyncpg.Connection, learner_profile_id: UUID, *, window: int = 5
) -> dict[str, list[float]]:
    """Recent post-session scores per dimension, oldest first — the history the
    volatility term reads (ADR 0008 §2.2). Empty until daily sessions exist.
    """
    rows = await conn.fetch(
        """
        SELECT skill_targeted, post_session_score
        FROM (
            SELECT skill_targeted, post_session_score, completed_at,
                   row_number() OVER (
                       PARTITION BY skill_targeted ORDER BY completed_at DESC
                   ) AS recency
            FROM daily_sessions
            WHERE learner_profile_id = $1
              AND post_session_score IS NOT NULL
              AND completed_at IS NOT NULL
              AND skill_targeted = ANY($2::text[])
        ) ranked
        WHERE recency <= $3
        ORDER BY skill_targeted, completed_at
        """,
        learner_profile_id,
        list(SCHEDULABLE_DIMENSIONS),
        window,
    )
    history: dict[str, list[float]] = {}
    for row in rows:
        history.setdefault(row["skill_targeted"], []).append(float(row["post_session_score"]))
    return history
