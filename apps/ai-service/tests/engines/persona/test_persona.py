"""Teaching persona layer tests (PRD §17)."""

import pytest

from app.engines.persona import (
    FREE_TIER_PERSONAS,
    PERSONAS,
    Persona,
    PersonaNotAvailableError,
    build_persona_layer,
    get_persona,
    resolve_persona,
)
from app.engines.writing_evaluation.exam_config import load_exam_config
from app.engines.writing_evaluation.prompt_builder import build_scoring_messages


class TestTierGating:
    def test_free_tier_gets_companion_only(self):
        assert FREE_TIER_PERSONAS == (Persona.COMPANION,)

    @pytest.mark.parametrize("value", ["coach", "examiner"])
    def test_a_pro_persona_downgrades_on_the_free_tier(self, value):
        # A lapsed Pro still has `coach` on their profile; their next session
        # should carry on as Companion rather than fail (§17.4).
        assert resolve_persona(value, tier="free").persona is Persona.COMPANION

    @pytest.mark.parametrize("value", ["companion", "coach", "examiner"])
    def test_pro_keeps_whatever_it_asked_for(self, value):
        assert resolve_persona(value, tier="pro").persona is Persona(value)

    def test_companion_is_never_gated(self):
        assert resolve_persona("companion", tier="free").persona is Persona.COMPANION


class TestPersonaConfig:
    def test_examiner_disables_socratic_follow_up(self):
        # §17.3: the examiner evaluates without guiding.
        assert PERSONAS[Persona.EXAMINER].socratic_enabled is False
        assert PERSONAS[Persona.COACH].socratic_enabled is True
        assert PERSONAS[Persona.COMPANION].socratic_enabled is True

    def test_every_teaching_persona_enum_value_is_configured(self):
        assert set(PERSONAS) == set(Persona)

    def test_an_unknown_persona_raises(self):
        with pytest.raises(PersonaNotAvailableError):
            get_persona("drill_sergeant")


class TestPromptLayer:
    @pytest.mark.parametrize("value", ["companion", "coach", "examiner"])
    def test_each_persona_yields_distinct_layer_text(self, value):
        layer = build_persona_layer(value, tier="pro")

        assert PERSONAS[Persona(value)].display_name in layer

    def test_scoring_prompts_carry_no_persona_layer_at_all(self):
        config = load_exam_config("ielts_academic")
        system = build_scoring_messages(config, prompt_text="p", essay_text="e")[0].content

        assert "Teaching persona" not in system
        for persona_config in PERSONAS.values():
            assert persona_config.prompt not in system

    def test_the_free_tier_cannot_reach_a_pro_layer(self):
        assert build_persona_layer("examiner", tier="free") == PERSONAS[Persona.COMPANION].prompt
