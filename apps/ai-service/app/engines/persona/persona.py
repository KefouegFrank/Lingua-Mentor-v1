"""Teaching Persona configurations — Layer 3 of the prompt pipeline (§19.4).

A persona sets tone, correction style, encouragement pattern and the Socratic
flag (§17.2). It sits below Policy & Guardrails and above Task Instruction, so
it can colour *how* the AI speaks and never *what* it is allowed to assert —
rubric scores, CEFR classification and skill-vector updates are identical under
every persona (§17.3). That is why the writing scorer omits this layer outright
rather than passing a neutral one.
"""

import enum
from dataclasses import dataclass


class Persona(str, enum.Enum):
    """Mirrors the `teaching_persona` PG enum (db/models/enums.py)."""

    COMPANION = "companion"
    COACH = "coach"
    EXAMINER = "examiner"


class PersonaNotAvailableError(ValueError):
    """Raised when a tier doesn't include the requested persona (§17.4)."""


@dataclass(frozen=True)
class PersonaConfig:
    persona: Persona
    display_name: str
    description: str
    # §17.3: Examiner evaluates without guiding, so it never asks follow-ups.
    socratic_enabled: bool
    pro_only: bool
    prompt: str


_COMPANION_PROMPT = """Teaching persona — Companion:
- Warm, patient and conversational. You are building the learner's confidence
  as much as their language.
- Let minor errors pass when correcting them would break the flow of the
  exchange; pick the one or two that matter most.
- Celebrate progress out loud, and be specific about what improved.
- Keep the learner talking. A reply that ends the conversation has failed."""

_COACH_PROMPT = """Teaching persona — Coach:
- Direct, concise and error-focused. The learner has an exam date and wants
  drill, not comfort.
- Surface every mistake you see, immediately, with a targeted correction.
- Skip the encouragement preamble. Lead with what is wrong and how to fix it.
- Push the learner past their current level rather than affirming it."""

_EXAMINER_PROMPT = """Teaching persona — Examiner:
- Formal, clinical and rubric-strict. You are replicating the real exam room.
- Offer no encouragement, no coaching and no hints. Evaluate; do not guide.
- Do not ask follow-up questions to help the learner recover a weak answer.
- Report what the response demonstrates, in the exam's own vocabulary."""


PERSONAS: dict[Persona, PersonaConfig] = {
    Persona.COMPANION: PersonaConfig(
        persona=Persona.COMPANION,
        display_name="Companion",
        description="Warm and encouraging. Builds confidence and keeps you talking.",
        socratic_enabled=True,
        pro_only=False,
        prompt=_COMPANION_PROMPT,
    ),
    Persona.COACH: PersonaConfig(
        persona=Persona.COACH,
        display_name="Coach",
        description="Direct and error-focused. Exam-drill style for a near exam date.",
        socratic_enabled=True,
        pro_only=True,
        prompt=_COACH_PROMPT,
    ),
    Persona.EXAMINER: PersonaConfig(
        persona=Persona.EXAMINER,
        display_name="Examiner",
        description="Formal and clinical. Mirrors the real exam, with no coaching.",
        socratic_enabled=False,
        pro_only=True,
        prompt=_EXAMINER_PROMPT,
    ),
}

# §17.4: the free tier gets Companion, which is also the fallback below.
FREE_TIER_PERSONAS = tuple(p for p, c in PERSONAS.items() if not c.pro_only)


def get_persona(value: str) -> PersonaConfig:
    try:
        return PERSONAS[Persona(value)]
    except ValueError:
        raise PersonaNotAvailableError(f"unknown persona '{value}'") from None


def resolve_persona(value: str, *, tier: str) -> PersonaConfig:
    """The persona a tier may actually use.

    Downgrades rather than raises: a learner who lapses from Pro to free still
    has `coach` stored on their profile, and their next session should carry on
    with Companion instead of failing (§17.4).
    """
    config = get_persona(value)
    if config.pro_only and tier != "pro":
        return PERSONAS[Persona.COMPANION]
    return config


def build_persona_layer(value: str, *, tier: str) -> str:
    """Layer 3 text for the prompt stack, gated by tier."""
    return resolve_persona(value, tier=tier).prompt
