"""Daily micro-session generation tests (PRD §15.2, §23.3, ADR 0009)."""

import json

import pytest

from app.engines.adaptive_learning import (
    DailySessionError,
    build_daily_session_messages,
    generate_daily_session,
    parse_session_content,
)
from app.engines.persona import PERSONAS, Persona
from app.providers.llm.base import LLMMessage, LLMProvider, LLMResponse


def _valid_payload(dimension="grammar", exercises=4):
    return {
        "type": f"{dimension}_drill",
        "prompt": "Rewrite each sentence using the correct verb form.",
        "exercises": [
            {"item": f"She go to work yesterday. ({i})", "focus": "past simple"}
            for i in range(exercises)
        ],
        "estimated_duration_minutes": 5,
    }


class ScriptedProvider(LLMProvider):
    name = "scripted"

    def stream(self, messages, *, model, temperature, max_tokens=None):
        raise NotImplementedError("scoring never streams")

    def __init__(self, content: str):
        self._content = content
        self.calls: list[dict] = []

    async def complete(
        self, messages: list[LLMMessage], *, model, temperature, max_tokens=None, json_mode=False
    ) -> LLMResponse:
        self.calls.append(
            {"messages": messages, "model": model, "max_tokens": max_tokens, "json_mode": json_mode}
        )
        return LLMResponse(
            content=self._content,
            provider="scripted",
            model_name=model,
            model_version="test",
            input_token_count=10,
            output_token_count=20,
            latency_ms=5,
        )


class TestPromptAssembly:
    def test_the_drill_carries_the_learner_persona(self):
        # Layer 3 belongs here even though scoring omits it (§17.3): a drill's
        # tone is the learner's to choose.
        system = build_daily_session_messages(
            dimension="grammar", persona="coach", tier="pro", language="en"
        )[0].content

        assert PERSONAS[Persona.COACH].prompt in system

    def test_a_free_learner_cannot_get_a_pro_persona_drill(self):
        system = build_daily_session_messages(
            dimension="grammar", persona="examiner", tier="free", language="en"
        )[0].content

        assert PERSONAS[Persona.COMPANION].prompt in system
        assert PERSONAS[Persona.EXAMINER].prompt not in system

    def test_an_unassessed_learner_is_pitched_at_b1_not_guessed_high(self):
        system = build_daily_session_messages(
            dimension="grammar", persona="companion", tier="free", language="en"
        )[0].content

        assert "not yet assessed" in system
        assert "B1" in system

    def test_an_assessed_level_reaches_the_prompt(self):
        system = build_daily_session_messages(
            dimension="vocabulary", persona="companion", tier="free", language="en", cefr_level="C1"
        )[0].content

        assert "CEFR C1" in system

    def test_the_policy_layer_forbids_scoring_language(self):
        # A drill is practice; §21.3 bands come from evaluation, never here.
        system = build_daily_session_messages(
            dimension="grammar", persona="companion", tier="free", language="en"
        )[0].content

        assert "Never state or imply an exam band" in system

    def test_a_dimension_with_no_drill_is_refused(self):
        # pronunciation is schedulable only from Phase 2 (ADR 0008 §2.3).
        with pytest.raises(DailySessionError):
            build_daily_session_messages(
                dimension="pronunciation", persona="companion", tier="free", language="en"
            )


class TestParsing:
    def test_a_valid_payload_parses(self):
        content = parse_session_content(json.dumps(_valid_payload()), "grammar")

        assert content.type == "grammar_drill"
        assert len(content.exercises) == 4

    def test_exercises_never_carry_an_answer_key(self):
        # Answers are AI-evaluated (§36 /mentor/evaluate-response); shipping one
        # to the client would make the skill-vector update meaningless.
        content = parse_session_content(json.dumps(_valid_payload()), "grammar")

        assert not hasattr(content.exercises[0], "answer")
        assert "answer" not in content.exercises[0].model_dump()

    def test_a_drill_for_the_wrong_dimension_is_rejected(self):
        with pytest.raises(ValueError):
            parse_session_content(json.dumps(_valid_payload("vocabulary")), "grammar")

    def test_an_empty_exercise_list_is_rejected(self):
        payload = _valid_payload(exercises=0)

        with pytest.raises(Exception):
            parse_session_content(json.dumps(payload), "grammar")


class TestGeneration:
    async def test_a_drill_routes_mid_tier_and_caps_its_length(self):
        # §55 cost control: a drill is low-complexity, so it must not burn the
        # high-tier model or run unbounded.
        provider = ScriptedProvider(json.dumps(_valid_payload()))

        await generate_daily_session(
            provider,
            dimension="grammar",
            persona="companion",
            tier="free",
            language="en",
            model="llama-3.1-8b-instant",
        )

        assert provider.calls[0]["model"] == "llama-3.1-8b-instant"
        assert provider.calls[0]["max_tokens"] == 700
        assert provider.calls[0]["json_mode"] is True

    async def test_unusable_output_raises_rather_than_retrying(self):
        provider = ScriptedProvider("not json at all")

        with pytest.raises(DailySessionError):
            await generate_daily_session(
                provider,
                dimension="grammar",
                persona="companion",
                tier="free",
                language="en",
                model="m",
            )

        # One call, no retry: a missing drill costs a retry, not a wrong score.
        assert len(provider.calls) == 1

    async def test_the_result_carries_audit_metadata_for_ai_model_runs(self):
        provider = ScriptedProvider(json.dumps(_valid_payload()))

        result = await generate_daily_session(
            provider,
            dimension="grammar",
            persona="companion",
            tier="free",
            language="en",
            model="m",
        )

        # daily_sessions.ai_model_run_id is NOT NULL — the row cannot exist
        # without this.
        assert result.response.response_hash
        assert result.response.input_token_count == 10
