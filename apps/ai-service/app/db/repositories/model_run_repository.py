"""asyncpg queries for ai_model_runs — every inference call gets a row
(PRD §11.5, non-negotiable traceability)."""

import json
from uuid import UUID

import asyncpg


async def insert_run(
    conn: asyncpg.Connection,
    *,
    session_id: UUID,
    session_type: str,
    task_type: str,
    provider: str,
    model_name: str,
    model_version: str,
    prompt_hash: str,
    response_hash: str,
    input_token_count: int,
    output_token_count: int,
    latency_ms: int,
    streaming_first_token_ms: int | None = None,
    was_fallback: bool = False,
    persona_config: dict | None = None,
    calibration_version: str | None = None,
) -> UUID:
    return await conn.fetchval(
        """
        INSERT INTO ai_model_runs (
            session_id, session_type, task_type, provider, model_name,
            model_version, prompt_hash, response_hash, input_token_count,
            output_token_count, latency_ms, streaming_first_token_ms,
            was_fallback, persona_config, calibration_version
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        RETURNING id
        """,
        session_id,
        session_type,
        task_type,
        provider,
        model_name,
        model_version,
        prompt_hash,
        response_hash,
        input_token_count,
        output_token_count,
        latency_ms,
        streaming_first_token_ms,
        was_fallback,
        json.dumps(persona_config) if persona_config is not None else None,
        calibration_version,
    )
