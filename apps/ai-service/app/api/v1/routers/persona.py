"""Teaching persona routes — mounted under /api/v1/personas.

Read-only config: the gateway proxies this so persona definitions live in one
place, the same way exam rubrics do (writing_eval.list_exams). Selection itself
is gateway-side — it writes learner_profiles, which this service only reads.
"""

from fastapi import APIRouter
from pydantic import BaseModel

from app.engines.persona import PERSONAS

router = APIRouter(prefix="/personas", tags=["personas"])


class PersonaOut(BaseModel):
    persona: str
    display_name: str
    description: str
    socratic_enabled: bool
    pro_only: bool


@router.get("", response_model=list[PersonaOut])
async def list_personas() -> list[PersonaOut]:
    """Every persona and its tier gate (PRD §17.2, §17.4)."""
    return [
        PersonaOut(
            persona=config.persona.value,
            display_name=config.display_name,
            description=config.description,
            socratic_enabled=config.socratic_enabled,
            pro_only=config.pro_only,
        )
        for config in PERSONAS.values()
    ]
