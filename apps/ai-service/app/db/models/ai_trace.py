"""AI trace domain (Master PRD §28.3, §11.5): ai_model_runs.

Every inference call gets a row — non-negotiable traceability requirement.
`session_id` is deliberately *not* a foreign key: it points at whichever
session type produced the call (writing/speaking/daily/exam), disambiguated
by `session_type`. PII separation (PRD §10.5): only opaque ids here, so GDPR
erasure anonymises by breaking the reference, not deleting audit rows.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Index, Integer, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models.base import Base


class AIModelRun(Base):
    __tablename__ = "ai_model_runs"
    __table_args__ = (Index("ix_ai_model_runs_session_id", "session_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    session_type: Mapped[str] = mapped_column(String(50))
    task_type: Mapped[str] = mapped_column(String(50))
    provider: Mapped[str] = mapped_column(String(50))
    model_name: Mapped[str] = mapped_column(String(100))
    model_version: Mapped[str] = mapped_column(String(50))
    prompt_hash: Mapped[str] = mapped_column(String(64))
    response_hash: Mapped[str] = mapped_column(String(64))
    input_token_count: Mapped[int] = mapped_column(Integer)
    output_token_count: Mapped[int] = mapped_column(Integer)
    latency_ms: Mapped[int] = mapped_column(Integer)
    streaming_first_token_ms: Mapped[int | None] = mapped_column(Integer)
    was_fallback: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    persona_config: Mapped[dict | None] = mapped_column(JSONB)
    calibration_version: Mapped[str | None] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
