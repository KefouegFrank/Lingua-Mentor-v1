"""BullMQ processor: writing_eval.

The queue payload is a pointer ({session_id, exam_type}); the writing_sessions
row is the source of truth — re-read here, never trusted from the payload.

Split into pure logic (run_writing_eval — testable without Job objects) and a
thin BullMQ adapter (make_processor).
"""

import logging
from collections.abc import Awaitable, Callable
from decimal import Decimal
from typing import Any
from uuid import UUID

import asyncpg
import httpx

from app.clients.ai_service import (
    RetryableEvalError,
    TerminalEvalError,
    evaluate_writing,
)
from app.db.writing_queries import claim_session, mark_failed, reset_to_pending, save_score

logger = logging.getLogger(__name__)


def _categories_from_response(payload: dict) -> list[dict]:
    # ai-service serializes Decimal as string ("6.50") — convert back to
    # Decimal so NUMERIC(4,2) round-trips without float drift.
    return [
        {
            "name": c["name"],
            "score": Decimal(str(c["score"])),
            "weight": Decimal(str(c["weight"])),
            "feedback": c.get("feedback"),
        }
        for c in payload["categories"]
    ]


async def run_writing_eval(
    *,
    session_id: UUID,
    pool: asyncpg.Pool,
    http: httpx.AsyncClient,
    is_final_attempt: bool,
) -> str:
    """Returns "scored" | "skipped" | "failed" (for logs and tests).

    Raises RetryableEvalError to signal BullMQ to schedule a retry.
    """
    async with pool.acquire() as conn:
        session = await claim_session(conn, session_id)
        if session is None:
            logger.info("writing_eval %s already completed — skipping duplicate", session_id)
            return "skipped"

        try:
            result = await evaluate_writing(
                http,
                exam_type=session["exam_type"],
                prompt_text=session["prompt_text"],
                essay_text=session["essay_text"],
                session_id=session_id,
                calibration_version=session["calibration_version"],
            )
        except TerminalEvalError as exc:
            # Bad input (unknown exam etc.) — retrying cannot help. The job
            # completes normally; the session records the failure.
            logger.warning("writing_eval %s terminal failure: %s", session_id, exc)
            await mark_failed(conn, session_id)
            return "failed"
        except RetryableEvalError as exc:
            if is_final_attempt:
                logger.error("writing_eval %s failed after final attempt: %s", session_id, exc)
                await mark_failed(conn, session_id)
                raise
            # Back to pending so the poll endpoint doesn't show 'processing'
            # for a job that's actually sitting in backoff.
            logger.warning("writing_eval %s transient failure, will retry: %s", session_id, exc)
            await reset_to_pending(conn, session_id)
            raise

        await save_score(
            conn,
            session_id=session_id,
            overall_band_score=Decimal(str(result["overall_band_score"])),
            cefr_level=result.get("cefr_level"),
            calibration_version=result.get("calibration_version"),
            categories=_categories_from_response(result),
            grammar_corrections=result.get("grammar_corrections"),
            vocabulary_suggestions=result.get("vocabulary_suggestions"),
        )
        logger.info("writing_eval %s scored", session_id)
        return "scored"


def make_processor(
    pool: asyncpg.Pool, http: httpx.AsyncClient
) -> Callable[[Any, str], Awaitable[str]]:
    async def process(job: Any, token: str) -> str:
        # bullmq-python increments attemptsMade only *after* an attempt
        # finishes, so during attempt N it equals N-1 (verified against
        # bullmq 2.25 worker source).
        attempts = job.opts.get("attempts") or 1
        is_final = job.attemptsMade + 1 >= attempts
        return await run_writing_eval(
            session_id=UUID(job.data["session_id"]),
            pool=pool,
            http=http,
            is_final_attempt=is_final,
        )

    return process
