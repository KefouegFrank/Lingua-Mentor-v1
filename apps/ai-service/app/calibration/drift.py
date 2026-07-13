"""Calibration drift check (Master PRD §27.2).

Compares a fresh harness run against the active (displayed) baseline per exam
type: a Pearson drop greater than DRIFT_THRESHOLD from the baseline is a drift
event — scoring for that exam must be treated as frozen until investigated.

This is the comparison logic only. The §27.2 weekly cadence needs human
re-grades of recent essays, a data loop that can't exist before launch — so
the check is run manually via the CLI (`--drift-check`) for now, and gets a
scheduler once that loop is real. Building cron wiring that alerts on nothing
would be noise, not monitoring.
"""

from dataclasses import dataclass
from decimal import Decimal

import asyncpg

from app.calibration.harness import CalibrationReport
from app.db.repositories import calibration_repository

# §27.2: "Correlation drop > 0.05 from baseline triggers immediate alert.
# Scoring frozen until investigated."
DRIFT_THRESHOLD = Decimal("0.05")


@dataclass(frozen=True)
class DriftResult:
    exam_type: str
    baseline_version: str | None
    baseline_pearson: Decimal | None
    current_pearson: Decimal
    # None when there is no baseline to drift from (a first run can't drift).
    drop: Decimal | None

    @property
    def has_baseline(self) -> bool:
        return self.baseline_version is not None

    @property
    def drifted(self) -> bool:
        return self.drop is not None and self.drop > DRIFT_THRESHOLD


async def check_drift(
    conn: asyncpg.Connection, reports: list[CalibrationReport]
) -> list[DriftResult]:
    """One DriftResult per report, against that exam's active baseline.

    Decimal throughout — comparing a float Pearson against a NUMERIC baseline
    at a 0.05 threshold is exactly the rounding-drift trap the project-wide
    no-float rule exists to avoid.
    """
    results = []
    for report in reports:
        current = Decimal(str(round(report.overall_pearson, 4)))
        baseline = await calibration_repository.get_active_baseline(conn, report.exam_type)
        if baseline is None:
            results.append(
                DriftResult(
                    exam_type=report.exam_type,
                    baseline_version=None,
                    baseline_pearson=None,
                    current_pearson=current,
                    drop=None,
                )
            )
            continue
        baseline_pearson = Decimal(str(baseline["overall_pearson"]))
        results.append(
            DriftResult(
                exam_type=report.exam_type,
                baseline_version=baseline["calibration_version"],
                baseline_pearson=baseline_pearson,
                current_pearson=current,
                # Signed: only a *drop* counts — improving on the baseline
                # is not drift (§27.2 alerts on degradation).
                drop=baseline_pearson - current,
            )
        )
    return results
