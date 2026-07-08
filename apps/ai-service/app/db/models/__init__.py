"""ORM models — Alembic autogenerate source only (conventions doc §4).

Grouped by the six schema domains of Master PRD §28.3. Every model must be
imported here or Alembic will silently drop its table from the diff.
"""

from app.db.models.ai_trace import AIModelRun
from app.db.models.analytics import ReadinessSnapshot, ShareEvent
from app.db.models.base import Base
from app.db.models.calibration import CalibrationBaseline
from app.db.models.evaluation import (
    ScoreAppeal,
    SpeakingSession,
    WritingScoreBreakdown,
    WritingSession,
)
from app.db.models.exam import ExamAttempt, ExamSection
from app.db.models.identity import LearnerProfile, User
from app.db.models.learning import DailySession, SkillVector

__all__ = [
    "AIModelRun",
    "Base",
    "CalibrationBaseline",
    "DailySession",
    "ExamAttempt",
    "ExamSection",
    "LearnerProfile",
    "ReadinessSnapshot",
    "ScoreAppeal",
    "ShareEvent",
    "SkillVector",
    "SpeakingSession",
    "User",
    "WritingScoreBreakdown",
    "WritingSession",
]
