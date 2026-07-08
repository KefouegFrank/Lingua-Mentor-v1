"""Queue registry — maps BullMQ queue names to processor factories.

Queue names MUST match apps/api-gateway/src/config/constants.ts 1:1 (the
producer and this registry are the two ends of the same wire), and each name
matches its module in app/tasks/ for easy tracing (see README).
"""

from collections.abc import Awaitable, Callable
from typing import Any

import asyncpg
import httpx

from app.tasks import writing_eval_task

QUEUE_WRITING_EVAL = "writing_eval"

Processor = Callable[[Any, str], Awaitable[Any]]


def build_queue_registry(pool: asyncpg.Pool, http: httpx.AsyncClient) -> dict[str, Processor]:
    return {
        QUEUE_WRITING_EVAL: writing_eval_task.make_processor(pool, http),
        # Slice 8+: appeal_eval, srs_batch_generation, calibration_recompute
    }
