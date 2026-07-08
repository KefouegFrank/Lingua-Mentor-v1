"""Exam domain (Master PRD §28.3, ERD §29): exam_attempts, exam_sections.

Section rows are created per exam-YAML section definition when an attempt
starts; subjective sections link out to writing/speaking sessions for their
actual evaluation (PRD §24).
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models.base import Base
from app.db.models.enums import ExamAttemptStatus, pg_enum


class ExamAttempt(Base):
    __tablename__ = "exam_attempts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    learner_profile_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("learner_profiles.id", ondelete="CASCADE")
    )
    exam_type: Mapped[str] = mapped_column(String(50))
    status: Mapped[ExamAttemptStatus] = mapped_column(
        pg_enum(ExamAttemptStatus, "exam_attempt_status"),
        server_default=ExamAttemptStatus.IN_PROGRESS.value,
    )
    overall_band_score: Mapped[float | None] = mapped_column(Numeric(4, 2))
    target_band_score: Mapped[float | None] = mapped_column(Numeric(3, 1))
    # Readiness index at the moment the attempt started — lets the Readiness
    # Engine compare predicted vs achieved later (PRD §25).
    readiness_at_attempt: Mapped[float | None] = mapped_column(Numeric(5, 3))
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ExamSection(Base):
    __tablename__ = "exam_sections"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    exam_attempt_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("exam_attempts.id", ondelete="CASCADE")
    )
    section_type: Mapped[str] = mapped_column(String(50))  # e.g. writing_task_2
    sequence: Mapped[int] = mapped_column(Integer)
    # Subjective sections delegate scoring: exactly one of these links.
    writing_session_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("writing_sessions.id", ondelete="SET NULL")
    )
    speaking_session_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("speaking_sessions.id", ondelete="SET NULL")
    )
    response_text: Mapped[str | None] = mapped_column(Text)  # auto-save target
    section_score: Mapped[float | None] = mapped_column(Numeric(4, 2))
    time_limit_seconds: Mapped[int] = mapped_column(Integer)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
