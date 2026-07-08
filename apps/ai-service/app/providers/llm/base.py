"""Abstract LLM provider interface — every vendor implements this.

Engines call this interface only, never a vendor SDK (conventions doc §7,
PRD §11.3). The response carries everything AIModelRun logging needs, so
traceability is a property of the interface, not each call site's diligence.
"""

import hashlib
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class LLMMessage:
    role: str  # "system" | "user" | "assistant"
    content: str


@dataclass(frozen=True)
class LLMResponse:
    """A completed (non-streaming) inference call, with audit metadata."""

    content: str
    provider: str
    model_name: str
    model_version: str
    input_token_count: int
    output_token_count: int
    latency_ms: int

    @property
    def response_hash(self) -> str:
        return hashlib.sha256(self.content.encode()).hexdigest()


def prompt_hash(messages: list[LLMMessage]) -> str:
    """Stable hash of the fully-assembled prompt, for AIModelRun.prompt_hash."""
    joined = "\x1e".join(f"{m.role}\x1f{m.content}" for m in messages)
    return hashlib.sha256(joined.encode()).hexdigest()


class LLMProviderError(Exception):
    """Raised on provider failure (network, 4xx/5xx, malformed payload).

    `retryable` guides the failover layer: rate limits and 5xx are retryable
    against a fallback provider; auth/validation errors are not.
    """

    def __init__(self, message: str, *, retryable: bool = False):
        super().__init__(message)
        self.retryable = retryable


class LLMProvider(ABC):
    """One instance per vendor. Stateless besides its HTTP client."""

    name: str

    @abstractmethod
    async def complete(
        self,
        messages: list[LLMMessage],
        *,
        model: str,
        temperature: float,
        max_tokens: int | None = None,
        json_mode: bool = False,
    ) -> LLMResponse:
        """Run a full (non-streaming) completion.

        json_mode=True asks the vendor to constrain output to a single JSON
        object — used by every scoring task so schema validation has a chance.
        """
