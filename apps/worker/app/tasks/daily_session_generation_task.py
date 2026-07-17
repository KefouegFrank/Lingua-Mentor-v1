"""BullMQ processor: daily_session_generation.

One job per active learner, fanned out by srs_batch_generation. ai-service does
the SRS pick, the generation and the write; this only drives it and keeps the
batch's failures isolated to the learner they belong to.
"""

import logging
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import asyncpg
import httpx

from app.clients.ai_service import RetryableEvalError, TerminalEvalError, generate_daily_session
from app.db.daily_session_queries import session_exists

logger = logging.getLogger(__name__)


async def run_daily_session_generation(
    *, learner_profile_id: UUID, pool: asyncpg.Pool, http: httpx.AsyncClient
) -> dict[str, Any]:
    session_date = datetime.now(UTC).date()

    async with pool.acquire() as conn:
        # The learner may have opened the app before the batch reached them.
        if await session_exists(conn, learner_profile_id, session_date):
            logger.info("daily session already exists for %s, skipping", learner_profile_id)
            return {"learner_profile_id": str(learner_profile_id), "skipped": True}

    try:
        result = await generate_daily_session(http, learner_profile_id=learner_profile_id)
    except TerminalEvalError as err:
        # Nothing a retry fixes, and no learner is waiting — drop it and let
        # tomorrow's batch try again rather than fail the job.
        logger.warning("daily session unavailable for %s: %s", learner_profile_id, err)
        return {"learner_profile_id": str(learner_profile_id), "skipped": True}
    except RetryableEvalError:
        raise

    return {
        "learner_profile_id": str(learner_profile_id),
        "skill_targeted": result["skill_targeted"],
        "skipped": False,
    }


def make_processor(
    pool: asyncpg.Pool, http: httpx.AsyncClient
) -> Callable[[Any, str], Awaitable[Any]]:
    async def process(job: Any, job_token: str) -> Any:
        return await run_daily_session_generation(
            learner_profile_id=UUID(job.data["learner_profile_id"]), pool=pool, http=http
        )

    return process
