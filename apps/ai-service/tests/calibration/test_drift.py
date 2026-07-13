"""Drift-check tests (PRD §27.2) — comparison against a real baselines table."""

import json
from datetime import datetime, timezone
from decimal import Decimal

import pytest

from app.calibration.drift import DRIFT_THRESHOLD, check_drift
from app.calibration.harness import CalibrationReport, CefrAgreement
from app.db.repositories import calibration_repository
from tests.conftest import requires_db

pytestmark = [pytest.mark.asyncio, requires_db]


def _report(exam_type: str, pearson: float) -> CalibrationReport:
    """A minimal harness report — drift only reads exam_type + overall_pearson."""
    return CalibrationReport(
        exam_type=exam_type,
        sample_count=50,
        failed_count=0,
        overall_pearson=pearson,
        category_pearson={},
        cefr_agreement=CefrAgreement(sample_count=50, exact_rate=0.8, adjacent_or_exact_rate=0.95),
    )


async def _insert_baseline(db_conn, exam_type: str, pearson: float) -> None:
    await calibration_repository.insert_baseline(
        db_conn,
        calibration_version="v1.0-test",
        exam_type=exam_type,
        sample_count=60,
        overall_pearson=pearson,
        category_pearson=json.dumps({}),
        human_examiner_count=2,
        inter_rater_kappa=0.85,
        calibration_date=datetime.now(timezone.utc),
        signed_off_by="test",
    )


async def test_drop_beyond_threshold_is_drift(db_conn):
    await _insert_baseline(db_conn, "ielts_academic", 0.88)

    [result] = await check_drift(db_conn, [_report("ielts_academic", 0.80)])

    assert result.has_baseline
    assert result.baseline_version == "v1.0-test"
    assert result.drop == Decimal("0.08")
    assert result.drifted


async def test_small_drop_within_threshold_is_not_drift(db_conn):
    await _insert_baseline(db_conn, "ielts_academic", 0.88)

    [result] = await check_drift(db_conn, [_report("ielts_academic", 0.86)])

    assert result.drop == Decimal("0.02")
    assert not result.drifted


async def test_improvement_over_baseline_is_not_drift(db_conn):
    # §27.2 alerts on degradation only — a negative drop is fine.
    await _insert_baseline(db_conn, "ielts_academic", 0.86)

    [result] = await check_drift(db_conn, [_report("ielts_academic", 0.91)])

    assert result.drop < 0
    assert not result.drifted


async def test_exact_threshold_boundary_is_not_drift(db_conn):
    # The rule is drop *greater than* 0.05 (§27.2) — exactly 0.05 passes.
    await _insert_baseline(db_conn, "ielts_academic", 0.90)

    [result] = await check_drift(db_conn, [_report("ielts_academic", 0.85)])

    assert result.drop == DRIFT_THRESHOLD
    assert not result.drifted


async def test_no_baseline_reports_nothing_to_drift_from(db_conn):
    [result] = await check_drift(db_conn, [_report("delf_b2", 0.70)])

    assert not result.has_baseline
    assert result.drop is None
    assert not result.drifted
