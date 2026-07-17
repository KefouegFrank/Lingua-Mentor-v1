"""asyncpg queries for lesson_sessions / lesson_messages (ADR 0010)."""

from uuid import UUID

import asyncpg


async def create_session(
    conn: asyncpg.Connection, learner_profile_id: UUID, *, topic: str | None
) -> asyncpg.Record:
    return await conn.fetchrow(
        """
        INSERT INTO lesson_sessions (learner_profile_id, topic)
        VALUES ($1, $2)
        RETURNING id, learner_profile_id, topic, skill_targeted, started_at, completed_at
        """,
        learner_profile_id,
        topic,
    )


async def get_session(
    conn: asyncpg.Connection, lesson_session_id: UUID, learner_profile_id: UUID
) -> asyncpg.Record | None:
    """Ownership is in the WHERE clause: someone else's lesson reads as absent."""
    return await conn.fetchrow(
        """
        SELECT id, learner_profile_id, topic, skill_targeted, started_at, completed_at
        FROM lesson_sessions
        WHERE id = $1 AND learner_profile_id = $2
        """,
        lesson_session_id,
        learner_profile_id,
    )


async def get_history(
    conn: asyncpg.Connection, lesson_session_id: UUID, *, limit: int
) -> list[asyncpg.Record]:
    """The last `limit` turns, oldest first — the order a prompt needs."""
    rows = await conn.fetch(
        """
        SELECT role, content
        FROM lesson_messages
        WHERE lesson_session_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        """,
        lesson_session_id,
        limit,
    )
    return list(reversed(rows))


async def insert_message(
    conn: asyncpg.Connection,
    *,
    lesson_session_id: UUID,
    role: str,
    content: str,
    ai_model_run_id: UUID | None = None,
) -> UUID:
    return await conn.fetchval(
        """
        INSERT INTO lesson_messages (lesson_session_id, role, content, ai_model_run_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id
        """,
        lesson_session_id,
        role,
        content,
        ai_model_run_id,
    )
