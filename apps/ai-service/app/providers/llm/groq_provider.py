"""Groq implementation — current free-tier dev provider (conventions doc §7).

Talks to Groq's OpenAI-compatible chat completions endpoint directly over
httpx; no vendor SDK, keeping the dependency surface at exactly one HTTP
client for all providers.
"""

import time

import httpx

from app.providers.llm.base import (
    LLMMessage,
    LLMProvider,
    LLMProviderError,
    LLMResponse,
)

_BASE_URL = "https://api.groq.com/openai/v1"
# Statuses worth retrying against a fallback provider (PRD §11.3 failover
# triggers: rate limit / unavailable).
_RETRYABLE_STATUSES = {429, 500, 502, 503, 504}


class GroqProvider(LLMProvider):
    name = "groq"

    def __init__(self, api_key: str, *, timeout_seconds: float = 30.0):
        self._client = httpx.AsyncClient(
            base_url=_BASE_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=timeout_seconds,
        )

    async def complete(
        self,
        messages: list[LLMMessage],
        *,
        model: str,
        temperature: float,
        max_tokens: int | None = None,
        json_mode: bool = False,
    ) -> LLMResponse:
        payload: dict = {
            "model": model,
            "temperature": temperature,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
        }
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        started = time.monotonic()
        try:
            response = await self._client.post("/chat/completions", json=payload)
        except httpx.HTTPError as exc:
            raise LLMProviderError(f"groq request failed: {exc}", retryable=True) from exc
        latency_ms = int((time.monotonic() - started) * 1000)

        if response.status_code != 200:
            raise LLMProviderError(
                f"groq returned {response.status_code}: {response.text[:500]}",
                retryable=response.status_code in _RETRYABLE_STATUSES,
            )

        body = response.json()
        try:
            content = body["choices"][0]["message"]["content"]
            usage = body["usage"]
        except (KeyError, IndexError) as exc:
            raise LLMProviderError(f"groq response missing fields: {exc}") from exc

        return LLMResponse(
            content=content,
            provider=self.name,
            model_name=model,
            # Groq echoes the concrete model it served — that's the version
            # traceability AIModelRun needs (PRD §11.5).
            model_version=body.get("model", model),
            input_token_count=usage.get("prompt_tokens", 0),
            output_token_count=usage.get("completion_tokens", 0),
            latency_ms=latency_ms,
        )

    async def aclose(self) -> None:
        await self._client.aclose()
