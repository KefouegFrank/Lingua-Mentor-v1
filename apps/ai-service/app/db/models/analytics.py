"""Analytics domain (Master PRD §28.3, ERD §29): readiness_snapshots,
share_events.
"""

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Index, Numeric, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models.base import Base


class ReadinessSnapshot(Base):
    __tablename__ = "readiness_snapshots"
    __table_args__ = (
        Index(
            "ix_readiness_snapshots_learner_date",
            "learner_profile_id",
            "snapshot_date",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    learner_profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("learner_profiles.id", ondelete="CASCADE")
    )
    snapshot_date: Mapped[date] = mapped_column(Date)
    readiness_score: Mapped[float] = mapped_column(Numeric(5, 3))
    projected_band_score: Mapped[float | None] = mapped_column(Numeric(4, 2))
    confidence_interval_low: Mapped[float | None] = mapped_column(Numeric(4, 2))
    confidence_interval_high: Mapped[float | None] = mapped_column(Numeric(4, 2))
    trend_factor: Mapped[float | None] = mapped_column(Numeric(5, 3))
    volatility_factor: Mapped[float | None] = mapped_column(Numeric(5, 3))
    weighted_skill_average: Mapped[float | None] = mapped_column(Numeric(5, 3))
    delta_from_previous: Mapped[float | None] = mapped_column(Numeric(6, 4))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )


class ShareEvent(Base):
    __tablename__ = "share_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    learner_profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("learner_profiles.id", ondelete="CASCADE")
    )
    exam_attempt_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("exam_attempts.id", ondelete="CASCADE")
    )
    band_score_displayed: Mapped[float] = mapped_column(Numeric(4, 2))
    delta_displayed: Mapped[float | None] = mapped_column(Numeric(4, 2))
    platform: Mapped[str | None] = mapped_column(String(50))
    card_template_version: Mapped[str] = mapped_column(String(20))
    shared_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
