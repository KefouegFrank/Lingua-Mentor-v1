"""API tests for /api/v1/writing-eval — full ASGI stack, fake LLM, real DB."""

import json
import uuid

import httpx
import pytest

from app.api.v1.deps import get_db, get_llm_provider
from app.main import app
from tests.conftest import requires_db
from tests.engines.writing_evaluation.test_engine import FakeProvider, _valid_ielts_payload

pytestmark = [pytest.mark.asyncio, requires_db]


@pytest.fixture
def client(db_conn):
    provider = FakeProvider([json.dumps(_valid_ielts_payload())])
    app.dependency_overrides[get_db] = lambda: db_conn
    app.dependency_overrides[get_llm_provider] = lambda: provider
    transport = httpx.ASGITransport(app=app)
    yield httpx.AsyncClient(transport=transport, base_url="http://test")
    app.dependency_overrides.clear()


async def test_evaluate_scores_and_logs_model_run(client, db_conn):
    session_id = str(uuid.uuid4())
    response = await client.post(
        "/api/v1/writing-eval/evaluate",
        json={
            "exam_type": "ielts_academic",
            "prompt_text": "Discuss X.",
            "essay_text": "My essay...",
            "session_id": session_id,
            "session_type": "writing",
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["overall_band_score"] == "6.50"
    assert body["cefr_level"] == "B2"

    # Traceability (PRD §28.2): the AIModelRun row must exist and tie back.
    run = await db_conn.fetchrow(
        "SELECT * FROM ai_model_runs WHERE id = $1", uuid.UUID(body["ai_model_run_id"])
    )
    assert run is not None
    assert str(run["session_id"]) == session_id
    assert run["task_type"] == "writing_scoring"
    assert run["provider"] == "fake"


async def test_unknown_exam_returns_error_envelope(client):
    response = await client.post(
        "/api/v1/writing-eval/evaluate",
        json={"exam_type": "hsk", "prompt_text": "p", "essay_text": "e"},
    )
    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "UNKNOWN_EXAM"
    assert error["field"] == "exam_type"


async def test_validation_error_uses_envelope(client):
    response = await client.post(
        "/api/v1/writing-eval/evaluate",
        json={"exam_type": "ielts_academic", "prompt_text": "", "essay_text": "e"},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_list_exams(client):
    response = await client.get("/api/v1/writing-eval/exams")
    assert response.status_code == 200
    exams = {e["exam_id"]: e for e in response.json()}
    assert set(exams) == {"delf_b1", "delf_b2", "ielts_academic", "ielts_general", "toefl_ibt"}
    assert len(exams["toefl_ibt"]["categories"]) == 3
