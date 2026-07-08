"""Status-code → exception mapping for the ai-service client (no DB needed)."""

import uuid

import httpx
import pytest

from app.clients.ai_service import (
    RetryableEvalError,
    TerminalEvalError,
    evaluate_writing,
)
from tests.conftest import mock_http

SESSION_ID = uuid.uuid4()


async def _call(client: httpx.AsyncClient) -> dict:
    return await evaluate_writing(
        client,
        exam_type="ielts_academic",
        prompt_text="p",
        essay_text="e",
        session_id=SESSION_ID,
        calibration_version=None,
    )


async def test_200_returns_payload_and_sends_session_fields():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        import json

        seen.update(json.loads(request.content))
        return httpx.Response(200, json={"overall_band_score": "6.50"})

    async with mock_http(handler) as client:
        result = await _call(client)

    assert result == {"overall_band_score": "6.50"}
    assert seen["session_id"] == str(SESSION_ID)
    assert seen["session_type"] == "submission"


async def test_400_raises_terminal_with_envelope_message():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            400, json={"error": {"code": "UNKNOWN_EXAM", "message": "no such exam"}}
        )

    async with mock_http(handler) as client:
        with pytest.raises(TerminalEvalError, match="UNKNOWN_EXAM: no such exam"):
            await _call(client)


async def test_422_raises_terminal():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(422, json={"detail": "validation"})

    async with mock_http(handler) as client:
        with pytest.raises(TerminalEvalError):
            await _call(client)


async def test_502_raises_retryable():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            502, json={"error": {"code": "EVALUATION_FAILED", "message": "model burp"}}
        )

    async with mock_http(handler) as client:
        with pytest.raises(RetryableEvalError, match="EVALUATION_FAILED"):
            await _call(client)


async def test_timeout_raises_retryable():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow model")

    async with mock_http(handler) as client:
        with pytest.raises(RetryableEvalError):
            await _call(client)


async def test_connect_error_raises_retryable():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused")

    async with mock_http(handler) as client:
        with pytest.raises(RetryableEvalError):
            await _call(client)
