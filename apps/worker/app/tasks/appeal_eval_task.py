"""BullMQ processor: appeal_eval (PRD §21.4 — score appeal secondary evaluation).

The queue payload is a pointer ({appeal_id}); the score_appeals row (joined to
its writing session) is the source of truth — re-read here, never trusted from
the payload.

Same pure-logic / thin-adapter split as writing_eval_task, and the same
failure taxonomy: terminal errors resolve to 'failed', transient errors reset
to 'pending' and re-raise for BullMQ's retry.
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
    evaluate_appeal,
)
from app.db.appeal_queries import claim_appeal, mark_failed, reset_to_pending, save_resolution

logger = logging.getLogger(__name__)

# PRD §21.4: a secondary score more than half a band from the original flags
# the appeal for human review and feeds the calibration monitoring loop.
HUMAN_REVIEW_DELTA = Decimal("0.5")


async def run_appeal_eval(
    *,
    appeal_id: UUID,
    pool: asyncpg.Pool,
    http: httpx.AsyncClient,
    is_final_attempt: bool,
) -> str:
    """Returns "resolved" | "skipped" | "failed" (for logs and tests).

    Raises RetryableEvalError to signal BullMQ to schedule a retry.
    """
    async with pool.acquire() as conn:
        appeal = await claim_appeal(conn, appeal_id)
        if appeal is None:
            logger.info("appeal_eval %s already completed — skipping duplicate", appeal_id)
            return "skipped"

        try:
            result = await evaluate_appeal(
                http,
                exam_type=appeal["exam_type"],
                prompt_text=appeal["prompt_text"],
                essay_text=appeal["essay_text"],
                appeal_id=appeal_id,
                calibration_version=appeal["calibration_version"],
            )
        except TerminalEvalError as exc:
            logger.warning("appeal_eval %s terminal failure: %s", appeal_id, exc)
            await mark_failed(conn, appeal_id)
            return "failed"
        except RetryableEvalError as exc:
            if is_final_attempt:
                logger.error("appeal_eval %s failed after final attempt: %s", appeal_id, exc)
                await mark_failed(conn, appeal_id)
                raise
            logger.warning("appeal_eval %s transient failure, will retry: %s", appeal_id, exc)
            await reset_to_pending(conn, appeal_id)
            raise

        # Decimal end-to-end: ai-service serializes NUMERIC as string ("6.50").
        secondary_score = Decimal(str(result["overall_band_score"]))
        delta = abs(secondary_score - Decimal(str(appeal["original_score"])))
        await save_resolution(
            conn,
            appeal_id=appeal_id,
            secondary_score=secondary_score,
            discrepancy_delta=delta,
            requires_human_review=delta > HUMAN_REVIEW_DELTA,
            secondary_model_config=result.get("secondary_model_config"),
        )
        logger.info(
            "appeal_eval %s resolved: original %s, secondary %s (delta %s%s)",
            appeal_id,
            appeal["original_score"],
            secondary_score,
            delta,
            ", human review" if delta > HUMAN_REVIEW_DELTA else "",
        )
        return "resolved"


def make_processor(
    pool: asyncpg.Pool, http: httpx.AsyncClient
) -> Callable[[Any, str], Awaitable[str]]:
    async def process(job: Any, token: str) -> str:
        # Same attemptsMade semantics as writing_eval_task: during attempt N
        # the counter reads N-1 (verified against bullmq 2.25 worker source).
        attempts = job.opts.get("attempts") or 1
        is_final = job.attemptsMade + 1 >= attempts
        return await run_appeal_eval(
            appeal_id=UUID(job.data["appeal_id"]),
            pool=pool,
            http=http,
            is_final_attempt=is_final,
        )

    return process
