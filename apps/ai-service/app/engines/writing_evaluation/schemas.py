"""Pydantic schemas for the writing evaluation pipeline.

LLMScoringOutput is the contract the model must emit (enforced JSON schema,
PRD §10.4 output schema enforcement); WritingEvaluationResult is what the
engine returns to callers after deterministic post-processing.
"""

from decimal import Decimal

from pydantic import BaseModel, Field, field_validator


class GrammarCorrection(BaseModel):
    original: str
    correction: str
    explanation: str


class VocabularySuggestion(BaseModel):
    original: str
    suggestion: str
    reason: str


class LLMCategoryScore(BaseModel):
    key: str
    score: Decimal = Field(ge=0, le=9)
    feedback: str

    @field_validator("score")
    @classmethod
    def half_band_increments(cls, v: Decimal) -> Decimal:
        if (v * 2) % 1 != 0:
            raise ValueError(f"score must be in 0.5 increments, got {v}")
        return v


class LLMScoringOutput(BaseModel):
    """Exactly what the LLM must return — nothing computed lives here.

    The overall band is deliberately NOT requested from the model: the
    composite is deterministic code (PRD §21.2 weighted formula), so the
    model can't emit an overall inconsistent with its category scores.
    """

    categories: list[LLMCategoryScore] = Field(min_length=3, max_length=4)
    grammar_corrections: list[GrammarCorrection] = Field(default_factory=list)
    vocabulary_suggestions: list[VocabularySuggestion] = Field(default_factory=list)


class CategoryResult(BaseModel):
    key: str
    name: str
    score: Decimal
    weight: Decimal
    feedback: str


class WritingEvaluationResult(BaseModel):
    exam_type: str
    overall_band_score: Decimal
    cefr_level: str | None
    categories: list[CategoryResult]
    grammar_corrections: list[GrammarCorrection]
    vocabulary_suggestions: list[VocabularySuggestion]
    calibration_version: str | None

    # Audit metadata for AIModelRun logging (PRD §11.5).
    provider: str
    model_name: str
    model_version: str
    prompt_hash: str
    response_hash: str
    input_token_count: int
    output_token_count: int
    latency_ms: int
    was_fallback: bool = False
