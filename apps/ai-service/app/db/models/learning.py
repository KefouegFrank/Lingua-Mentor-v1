"""Learning domain (Master PRD §28.3, ERD §29): skill_vectors, daily_sessions.

Skill scores are normalized 0–1 stored as NUMERIC(4,3); SRS state
(last_practiced + interval) is tracked per dimension (PRD §23.3).
`comprehension` has a score but no SRS fields — it's a Phase 1 proxy
dimension with nothing to practice directly yet.
"""

import uuid
from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models.base import Base


class SkillVector(Base):
    __tablename__ = "skill_vectors"
    __table_args__ = (
        # One vector per learner per language (EN and FR tracked separately).
        UniqueConstraint("learner_profile_id", "language"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    learner_profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("learner_profiles.id", ondelete="CASCADE")
    )
    language: Mapped[str] = mapped_column(String(10))

    grammar_score: Mapped[float] = mapped_column(Numeric(4, 3), server_default="0.500")
    grammar_last_practiced: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    grammar_srs_interval: Mapped[int] = mapped_column(Integer, server_default="1")

    vocabulary_score: Mapped[float] = mapped_column(Numeric(4, 3), server_default="0.500")
    vocabulary_last_practiced: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    vocabulary_srs_interval: Mapped[int] = mapped_column(Integer, server_default="1")

    coherence_score: Mapped[float] = mapped_column(Numeric(4, 3), server_default="0.500")
    coherence_last_practiced: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    coherence_srs_interval: Mapped[int] = mapped_column(Integer, server_default="1")

    pronunciation_score: Mapped[float] = mapped_column(Numeric(4, 3), server_default="0.500")
    pronunciation_last_practiced: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    pronunciation_srs_interval: Mapped[int] = mapped_column(Integer, server_default="1")

    fluency_score: Mapped[float] = mapped_column(Numeric(4, 3), server_default="0.500")
    fluency_last_practiced: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    fluency_srs_interval: Mapped[int] = mapped_column(Integer, server_default="1")

    comprehension_score: Mapped[float] = mapped_column(Numeric(4, 3), server_default="0.500")

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )


class DailySession(Base):
    __tablename__ = "daily_sessions"
    __table_args__ = (
        Index("ix_daily_sessions_learner_date", "learner_profile_id", "session_date"),
        # One session per learner per UTC day — the batch and an on-demand
        # request must converge on one row, not race into two (ADR 0009 §2.4).
        UniqueConstraint(
            "learner_profile_id", "session_date", name="uq_daily_sessions_learner_date"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    learner_profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("learner_profiles.id", ondelete="CASCADE")
    )
    session_date: Mapped[date] = mapped_column(Date)
    skill_targeted: Mapped[str] = mapped_column(String(30))
    srs_priority_score: Mapped[float] = mapped_column(Numeric(5, 3))
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    pre_session_score: Mapped[float | None] = mapped_column(Numeric(4, 3))
    post_session_score: Mapped[float | None] = mapped_column(Numeric(4, 3))
    delta_score: Mapped[float | None] = mapped_column(Numeric(5, 4))
    readiness_delta: Mapped[float | None] = mapped_column(Numeric(5, 4))
    ai_model_run_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ai_model_runs.id", ondelete="RESTRICT")
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )


class LessonSession(Base):
    """A text mentor-chat session (PRD §35.3, ADR 0010) — the §29 ERD has no
    lesson table, so this is new schema rather than a modelled one."""

    __tablename__ = "lesson_sessions"
    __table_args__ = (
        Index("ix_lesson_sessions_learner_started", "learner_profile_id", "started_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    learner_profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("learner_profiles.id", ondelete="CASCADE")
    )
    topic: Mapped[str | None] = mapped_column(String(200))
    skill_targeted: Mapped[str | None] = mapped_column(String(30))
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class LessonMessage(Base):
    """One chat turn — §19.4 Layer 7's conversation history."""

    __tablename__ = "lesson_messages"
    __table_args__ = (
        Index("ix_lesson_messages_session_created", "lesson_session_id", "created_at"),
        CheckConstraint("role IN ('learner', 'mentor')", name="ck_lesson_messages_role"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    lesson_session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("lesson_sessions.id", ondelete="CASCADE")
    )
    role: Mapped[str] = mapped_column(String(10))
    content: Mapped[str] = mapped_column(Text)
    ai_model_run_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("ai_model_runs.id", ondelete="RESTRICT")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
