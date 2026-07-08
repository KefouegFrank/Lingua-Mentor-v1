"""Shared FastAPI dependencies — DB connection, LLM provider.

JWT verification / rate limiting deps arrive with the first user-facing
route; the internal evaluate endpoint is only reachable from inside the
deployment (worker, calibration harness) per ADR 0001 §5 topology.
"""

from collections.abc import AsyncIterator

import asyncpg
from fastapi import Request

from app.db.session import get_pool
from app.providers.llm.base import LLMProvider


async def get_db() -> AsyncIterator[asyncpg.Connection]:
    async with get_pool().acquire() as conn:
        yield conn


def get_llm_provider(request: Request) -> LLMProvider:
    """Provider instance created in the app lifespan (app/main.py)."""
    return request.app.state.llm_provider
