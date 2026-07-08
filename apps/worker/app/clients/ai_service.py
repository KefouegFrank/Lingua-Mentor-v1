"""httpx client for ai-service's internal evaluation endpoint.

Error taxonomy mirrors ai-service's envelope semantics (app/core/errors.py):
4xx means the input can never succeed (unknown exam, validation) — retrying
is pointless; 5xx/timeouts are transient — BullMQ should retry.
"""

from uuid import UUID

import httpx

EVALUATE_PATH = "/api/v1/writing-eval/evaluate"


class TerminalEvalError(Exception):
    """4xx from ai-service: bad input — no retry can fix it."""


class RetryableEvalError(Exception):
    """502/5xx/timeout/transport failure: transient — worth a retry."""


def _envelope_message(response: httpx.Response) -> str:
    try:
        error = response.json()["error"]
        return f"{error['code']}: {error['message']}"
    except Exception:
        return f"HTTP {response.status_code}"


async def evaluate_writing(
    http: httpx.AsyncClient,
    *,
    exam_type: str,
    prompt_text: str,
    essay_text: str,
    session_id: UUID,
    calibration_version: str | None,
) -> dict:
    try:
        response = await http.post(
            EVALUATE_PATH,
            json={
                "exam_type": exam_type,
                "prompt_text": prompt_text,
                "essay_text": essay_text,
                "session_id": str(session_id),
                # Ties the AIModelRun row ai-service logs to this submission.
                "session_type": "submission",
                "calibration_version": calibration_version,
            },
        )
    except (httpx.TimeoutException, httpx.TransportError) as exc:
        raise RetryableEvalError(str(exc)) from exc

    if response.status_code == 200:
        return response.json()
    if 400 <= response.status_code < 500:
        raise TerminalEvalError(_envelope_message(response))
    raise RetryableEvalError(_envelope_message(response))
