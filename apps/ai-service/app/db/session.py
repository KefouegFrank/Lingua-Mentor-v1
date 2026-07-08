"""asyncpg connection pool — the runtime data-access path.

Sized per ADR 0001 §3.1: Neon's PgBouncer-based pooler handles upstream
connection scale, so this app-side pool stays small. Lifecycle is owned by
the FastAPI lifespan in app/main.py; repositories receive a pool/connection,
they never create one.
"""

import asyncpg

from app.core.config import get_settings

_pool: asyncpg.Pool | None = None


def _asyncpg_dsn(url: str) -> str:
    """asyncpg accepts postgresql:// but not the +asyncpg SQLAlchemy suffix."""
    return url.replace("postgresql+asyncpg://", "postgresql://", 1)


async def create_pool() -> asyncpg.Pool:
    """Create the module-level pool. Called once from the app lifespan."""
    global _pool
    settings = get_settings()
    _pool = await asyncpg.create_pool(
        dsn=_asyncpg_dsn(settings.database_url),
        min_size=settings.db_pool_min_size,
        max_size=settings.db_pool_max_size,
    )
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    """Return the live pool. Raises if called before lifespan startup."""
    if _pool is None:
        raise RuntimeError("DB pool not initialised — app lifespan has not run")
    return _pool
