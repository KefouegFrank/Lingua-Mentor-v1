"""Postgres ENUM types shared across models.

Values mirror the Master PRD ERD (§29) and actor/persona definitions
(§13, §17). Python enum *values* (lowercase strings) are what's stored —
`values_callable` below ensures SQLAlchemy emits those, not the member names.
"""

import enum

from sqlalchemy import Enum as SAEnum


class UserRole(str, enum.Enum):
    LEARNER = "learner"
    ADMIN = "admin"
    INSTITUTION_ADMIN = "institution_admin"


class SubscriptionTier(str, enum.Enum):
    FREE = "free"
    PRO = "pro"


class TeachingPersona(str, enum.Enum):
    COMPANION = "companion"
    COACH = "coach"
    EXAMINER = "examiner"


class LearningTrack(str, enum.Enum):
    FLUENCY = "fluency"
    EXAM = "exam"


class WritingSessionStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SCORED = "scored"
    FAILED = "failed"


class AppealStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    RESOLVED = "resolved"
    # PRD §37.4: a secondary evaluation that errors out must be visible as a
    # failure the learner can retry — never left stuck at 'processing'.
    FAILED = "failed"


class SpeakingSessionType(str, enum.Enum):
    PRACTICE = "practice"
    PLACEMENT = "placement"
    EXAM_SECTION = "exam_section"
    DAILY_DIAGNOSTIC = "daily_diagnostic"


class ExamAttemptStatus(str, enum.Enum):
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


def pg_enum(py_enum: type[enum.Enum], name: str) -> SAEnum:
    """Build a native PG enum column type that stores the str values."""
    return SAEnum(
        py_enum,
        name=name,
        values_callable=lambda e: [m.value for m in e],
    )
