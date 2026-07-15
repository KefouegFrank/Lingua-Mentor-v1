"""asyncpg queries for the appeal-eval job lifecycle (PRD §21.4).

Same claim/reset/fail pattern as writing_queries.py — including the
processing-inclusive claim guard, because BullMQ retries and stalled-job
redelivery re-enter with the row already 'processing'.

Band scores are NUMERIC(4,2) — pass Decimal, never float (PRD §28.2).
"""

import json
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

import asyncpg


async def claim_appeal(conn: asyncpg.Connection, appeal_id: UUID) -> asyncpg.Record | None:
    """Claim an appeal and pull the essay context in one round trip. None →
    already resolved/failed (double delivery): the caller should skip.

    The join re-reads the essay from writing_sessions — the appeal row carries
    only the original score; the session row stays the single source of truth
    for what gets re-evaluated.
    """
    return await conn.fetchrow(
        """
        UPDATE score_appeals sa SET status = 'processing'
        FROM writing_sessions ws
        WHERE sa.id = $1 AND sa.status IN ('pending', 'processing')
          AND ws.id = sa.writing_session_id
        RETURNING sa.id, sa.original_score,
                  ws.exam_type, ws.prompt_text, ws.essay_text, ws.calibration_version
        """,
        appeal_id,
    )


async def reset_to_pending(conn: asyncpg.Connection, appeal_id: UUID) -> None:
    """Back to pending before a retryable failure re-raises, so the poll
    endpoint never shows 'processing' for a job sitting in backoff."""
    await conn.execute("UPDATE score_appeals SET status = 'pending' WHERE id = $1", appeal_id)


async def mark_failed(conn: asyncpg.Connection, appeal_id: UUID) -> None:
    # PRD §37.4: the learner sees the failure and can retry; the original
    # score remains displayed untouched.
    await conn.execute("UPDATE score_appeals SET status = 'failed' WHERE id = $1", appeal_id)


async def save_resolution(
    conn: asyncpg.Connection,
    *,
    appeal_id: UUID,
    secondary_score: Decimal,
    discrepancy_delta: Decimal,
    requires_human_review: bool,
    secondary_model_config: dict | None,
) -> None:
    """Persist the resolved secondary evaluation. The original score is never
    overwritten — the appeal records the discrepancy; what to do about a large
    one is a human-review decision (PRD §21.4), not an automatic rescore."""
    await conn.execute(
        """
        UPDATE score_appeals
        SET status = 'resolved', secondary_score = $2, discrepancy_delta = $3,
            requires_human_review = $4, secondary_model_config = $5, resolved_at = $6
        WHERE id = $1
        """,
        appeal_id,
        secondary_score,
        discrepancy_delta,
        requires_human_review,
        json.dumps(secondary_model_config) if secondary_model_config is not None else None,
        datetime.now(UTC),
    )
