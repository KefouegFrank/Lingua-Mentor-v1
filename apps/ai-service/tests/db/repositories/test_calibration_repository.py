"""Integration tests for calibration_baselines persistence (Brief §7).

Insert-only by design; the "active" baseline is the latest displayable version
for an exam type — what score reports cite and what scoring resolves its
calibration_version from.
"""

import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest

from app.db.repositories import calibration_repository
from tests.conftest import requires_db

pytestmark = [pytest.mark.asyncio, requires_db]


async def _insert(db_conn, *, version, exam="ielts_academic", pearson=0.88, when=None, kappa=0.87):
    await calibration_repository.insert_baseline(
        db_conn,
        calibration_version=version,
        exam_type=exam,
        sample_count=80,
        overall_pearson=pearson,
        category_pearson=json.dumps({"task_response": 0.86}),
        human_examiner_count=2,
        inter_rater_kappa=kappa,
        calibration_date=when or datetime.now(timezone.utc),
        signed_off_by="Lead Examiner",
    )


async def test_insert_and_get_active(db_conn):
    await _insert(db_conn, version="v1.0-launch")
    row = await calibration_repository.get_active_baseline(db_conn, "ielts_academic")
    assert row is not None
    assert row["calibration_version"] == "v1.0-launch"
    assert row["sample_count"] == 80
    # float in → Decimal out, exact (NUMERIC(5,4)), no binary-float artifact.
    assert row["overall_pearson"] == Decimal("0.8800")


async def test_get_active_returns_latest_version(db_conn):
    now = datetime.now(timezone.utc)
    await _insert(db_conn, version="v1.0-launch", pearson=0.86, when=now - timedelta(days=30))
    await _insert(db_conn, version="v1.1-tuned", pearson=0.90, when=now)
    row = await calibration_repository.get_active_baseline(db_conn, "ielts_academic")
    assert row["calibration_version"] == "v1.1-tuned"
    assert row["overall_pearson"] == Decimal("0.9000")


async def test_get_active_unknown_exam_returns_none(db_conn):
    await _insert(db_conn, version="v1.0-launch")
    assert await calibration_repository.get_active_baseline(db_conn, "delf_b2") is None


async def test_insert_accepts_null_kappa(db_conn):
    """kappa is nullable — a run may record the baseline before IRR is finalised."""
    await _insert(db_conn, version="v1.0-launch", kappa=None)
    row = await calibration_repository.get_active_baseline(db_conn, "ielts_academic")
    assert row["calibration_version"] == "v1.0-launch"
