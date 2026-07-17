"""Typed settings from environment variables — fail fast, list what's missing."""

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    redis_url: str
    database_url: str
    ai_service_url: str
    concurrency: int = 2
    # ADR 0009 §2.2 — pre-generate only for learners who actually open the app.
    pregeneration_active_window_days: int = 14


def load_settings() -> Settings:
    required = {
        name: os.environ.get(name) for name in ("REDIS_URL", "DATABASE_URL", "AI_SERVICE_URL")
    }
    missing = sorted(name for name, value in required.items() if not value)
    if missing:
        raise RuntimeError(f"missing required environment variables: {', '.join(missing)}")
    return Settings(
        redis_url=required["REDIS_URL"],  # type: ignore[arg-type]
        database_url=required["DATABASE_URL"],  # type: ignore[arg-type]
        ai_service_url=required["AI_SERVICE_URL"],  # type: ignore[arg-type]
        concurrency=int(os.environ.get("WORKER_CONCURRENCY", "2")),
        pregeneration_active_window_days=int(
            os.environ.get("PREGENERATION_ACTIVE_WINDOW_DAYS", "14")
        ),
    )
