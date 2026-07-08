"""Typed loader for exam definitions in app/config/exams/*.yaml.

Exams are config, not code (conventions doc §8): engines consume this schema
and must never branch on exam_id. If an exam needs behaviour this schema
can't express, extend the schema — don't special-case the engine.
"""

from decimal import Decimal
from functools import lru_cache
from pathlib import Path

import yaml
from pydantic import BaseModel, Field, field_validator

EXAMS_DIR = Path(__file__).resolve().parents[2] / "config" / "exams"


class ScoreScale(BaseModel):
    min: Decimal
    max: Decimal
    increment: Decimal


class RubricCategory(BaseModel):
    key: str
    name: str
    weight: Decimal
    description: str
    band_descriptors: dict[str, str]


class CefrThreshold(BaseModel):
    cefr: str
    min_score: Decimal


class WritingConfig(BaseModel):
    task_name: str
    score_scale: ScoreScale
    rubric_categories: list[RubricCategory] = Field(min_length=3, max_length=4)
    cefr_mapping: list[CefrThreshold]

    @field_validator("rubric_categories")
    @classmethod
    def weights_sum_to_one(cls, categories: list[RubricCategory]) -> list[RubricCategory]:
        total = sum(c.weight for c in categories)
        # Small tolerance: 3-way splits are stored as 0.334/0.333/0.333.
        if abs(total - Decimal("1")) > Decimal("0.005"):
            raise ValueError(f"rubric weights must sum to 1.0, got {total}")
        return categories

    def cefr_for(self, score: Decimal) -> str | None:
        """Highest CEFR level whose threshold the score meets (PRD §7.3)."""
        level: str | None = None
        for threshold in sorted(self.cefr_mapping, key=lambda t: t.min_score):
            if score >= threshold.min_score:
                level = threshold.cefr
        return level


class ExamConfig(BaseModel):
    exam_id: str
    language: str
    display_name: str
    writing: WritingConfig


class UnknownExamError(ValueError):
    """Raised when no YAML exists for the requested exam_id."""


@lru_cache
def load_exam_config(exam_id: str) -> ExamConfig:
    path = EXAMS_DIR / f"{exam_id}.yaml"
    if not path.is_file():
        known = sorted(p.stem for p in EXAMS_DIR.glob("*.yaml"))
        raise UnknownExamError(f"unknown exam '{exam_id}' — known: {known}")
    with path.open() as f:
        return ExamConfig.model_validate(yaml.safe_load(f))
