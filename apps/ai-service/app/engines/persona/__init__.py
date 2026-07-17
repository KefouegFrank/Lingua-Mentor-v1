"""Teaching Persona layer (Master PRD §17) — public surface.

Layer 3 of the §19.4 prompt pipeline. Lives outside any one engine because
every conversational surface injects it: mentor chat, the daily micro-session,
and the Voice Agent. Scoring deliberately does not — see `persona.py`.
"""

from app.engines.persona.persona import (
    FREE_TIER_PERSONAS,
    PERSONAS,
    Persona,
    PersonaConfig,
    PersonaNotAvailableError,
    build_persona_layer,
    get_persona,
    resolve_persona,
)

__all__ = [
    "FREE_TIER_PERSONAS",
    "PERSONAS",
    "Persona",
    "PersonaConfig",
    "PersonaNotAvailableError",
    "build_persona_layer",
    "get_persona",
    "resolve_persona",
]
