"""CLI for the Phase 0 calibration harness.

Usage:
    python -m app.calibration <dataset.jsonl> [--output report.json]
                              [--concurrency 4]

    # Promote a passing run to a signed-off baseline (Brief §7, §9):
    python -m app.calibration <dataset.jsonl> --persist \
        --calibration-version v1.0-launch --examiner-count 2 \
        --kappa 0.87 --signed-off-by "Lead Examiner"

    # Drift check (PRD §27.2): compare this run to each exam's active
    # baseline; a Pearson drop > 0.05 is a drift event (exit 4):
    python -m app.calibration <dataset.jsonl> --drift-check

Requires GROQ_API_KEY (and the model tiers) from the environment/.env;
--persist and --drift-check additionally need DATABASE_URL. Prints a gate
summary per exam type. Exit code 0 only if every exam type passes every
*implemented* writing gate — and even then the run is a WRITING pass, not a
full Phase 0 pass, while WER/pronunciation is unbuilt (Brief §9, ADR 0006
§2.2). A partial pass is a no-go.
"""

import argparse
import asyncio
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

import asyncpg

from app.calibration.drift import DRIFT_THRESHOLD, check_drift
from app.calibration.harness import (
    CATEGORY_GATE,
    CEFR_GATE,
    OVERALL_GATE,
    full_phase0_ready,
    pending_gates,
    run_calibration,
)
from app.core.config import get_settings
from app.db.repositories import calibration_repository
from app.providers.llm.groq_provider import GroqProvider


def _print_summary(reports) -> bool:
    """Print per-exam gates. Returns True only if every exam type passes every
    implemented writing gate (Pearson overall + adversarial + CEFR boundary)."""
    all_passed = True
    for report in reports:
        all_passed &= report.writing_gates_passed
        pearson_flag = "PASS" if report.overall_gate_passed else "FAIL"
        print(f"\n=== {report.exam_type} ===")
        print(f"  essays scored : {report.sample_count} ({report.failed_count} failed)")
        print(
            f"  overall r     : {report.overall_pearson:.4f}  (gate {OVERALL_GATE}) "
            f"[{pearson_flag}] status={report.gate_status}"
        )
        for key, r in sorted(report.category_pearson.items()):
            flag = "" if r >= CATEGORY_GATE else f"  <-- below {CATEGORY_GATE}, tune this rubric"
            print(f"  {key:<28}: {r:.4f}{flag}")

        cefr = report.cefr_agreement
        cefr_flag = "PASS" if cefr.gate_passed else "FAIL"
        print(
            f"  CEFR agreement: exact {cefr.exact_rate:.2%} / adjacent-or-exact "
            f"{cefr.adjacent_or_exact_rate:.2%}  (gate {CEFR_GATE:.0%}) [{cefr_flag}]"
        )

        adv_flag = "PASS" if report.adversarial_gate_passed else "FAIL"
        print(f"  adversarial   : {report.adversarial_count} gamed essays [{adv_flag}]")
        for over in report.adversarial_overscored:
            print(
                f"      OVER-SCORED {over['essay_id']}: human {over['human']} -> "
                f"ai {over['ai']} (+{over['overscore']} band)"
            )

        if report.divergent_essays:
            print(
                f"  divergent (>1.0 band): {len(report.divergent_essays)} — review these for tuning"
            )
    return all_passed


def _print_gate_manifest() -> None:
    """Show the full Go/No-Go surface, including gates not yet buildable, so a
    green writing run is never mistaken for a full Phase 0 pass (ADR 0006 §2.2)."""
    print("\n=== Phase 0 gate coverage ===")
    for gate in pending_gates():
        suffix = f" — {gate.note}" if gate.note else ""
        print(f"  [PENDING] {gate.key}: {gate.description}{suffix}")
    if not pending_gates():
        print("  all gates implemented")


def _persist_precheck(reports, args) -> str | None:
    """Guard rails on writing a baseline — a Go/No-Go sign-off is a deliberate
    human act (Brief §9), so a baseline is only ever born from a green,
    single-exam, fully-specified run. Returns an error message, or None if OK."""
    exam_types = {r.exam_type for r in reports}
    if len(exam_types) != 1:
        return (
            "persist one exam type at a time — baseline metadata (examiner "
            "count, kappa) is per-exam, not per-run"
        )
    report = reports[0]
    if not report.writing_gates_passed:
        return f"{report.exam_type} fails a writing gate — a failing run must not become a baseline"
    if not args.calibration_version:
        return "--calibration-version is required with --persist"
    if args.examiner_count is None:
        return "--examiner-count is required with --persist (Brief §3.2)"
    return None


def _dsn() -> str:
    settings = get_settings()
    return settings.database_url.replace("postgresql+asyncpg://", "postgresql://", 1)


async def _run_drift_check(reports) -> bool:
    """Compare this run to each exam's active baseline (PRD §27.2). Returns
    True if any exam drifted. No baseline is reported, not failed — a first
    run has nothing to drift from."""
    conn = await asyncpg.connect(_dsn())
    try:
        results = await check_drift(conn, reports)
    finally:
        await conn.close()

    print(f"\n=== Drift check (threshold {DRIFT_THRESHOLD}, PRD §27.2) ===")
    any_drift = False
    for r in results:
        if not r.has_baseline:
            print(f"  {r.exam_type}: no active baseline — nothing to drift from")
            continue
        flag = "DRIFT" if r.drifted else "ok"
        print(
            f"  {r.exam_type}: baseline {r.baseline_version} r={r.baseline_pearson} "
            f"-> current r={r.current_pearson} (drop {r.drop}) [{flag}]"
        )
        if r.drifted:
            any_drift = True
            print(
                f"      ALERT: correlation dropped more than {DRIFT_THRESHOLD} below "
                f"baseline — treat {r.exam_type} scoring as frozen until investigated."
            )
    return any_drift


async def _persist_baseline(report, args) -> None:
    """Insert the single passing report as an immutable baseline row. The row
    is what score reports later cite ('calibrated against N essays', PRD §21.3)
    and what the scoring path resolves calibration_version from."""
    conn = await asyncpg.connect(_dsn())
    try:
        async with conn.transaction():
            await calibration_repository.insert_baseline(
                conn,
                calibration_version=args.calibration_version,
                exam_type=report.exam_type,
                sample_count=report.sample_count,
                overall_pearson=report.overall_pearson,
                category_pearson=json.dumps(report.category_pearson),
                human_examiner_count=args.examiner_count,
                inter_rater_kappa=args.kappa,
                calibration_date=datetime.now(UTC),
                signed_off_by=args.signed_off_by,
            )
    finally:
        await conn.close()


def main() -> int:
    parser = argparse.ArgumentParser(prog="python -m app.calibration")
    parser.add_argument("dataset", type=Path, help="JSONL essay dataset (see harness.py docstring)")
    parser.add_argument("--output", type=Path, help="write full JSON report here")
    parser.add_argument("--concurrency", type=int, default=4)
    parser.add_argument(
        "--persist",
        action="store_true",
        help="promote a passing single-exam run to a signed-off calibration baseline",
    )
    parser.add_argument(
        "--calibration-version",
        help="baseline version tag, e.g. v1.0-launch (required with --persist)",
    )
    parser.add_argument(
        "--signed-off-by", help="who accepted the Go/No-Go (calibration_baselines.signed_off_by)"
    )
    parser.add_argument(
        "--examiner-count",
        type=int,
        help="human examiners behind the consensus scores (required with --persist)",
    )
    parser.add_argument(
        "--kappa",
        type=float,
        help="human-human inter-rater kappa for the dataset (Brief §6.1, >= 0.80)",
    )
    parser.add_argument(
        "--drift-check",
        action="store_true",
        help="compare this run to each exam's active baseline; drop > 0.05 exits 4 (PRD §27.2)",
    )
    args = parser.parse_args()

    settings = get_settings()
    if not settings.groq_api_key:
        print("GROQ_API_KEY is not set", file=sys.stderr)
        return 2

    async def run():
        provider = GroqProvider(settings.groq_api_key)
        try:
            return await run_calibration(
                provider,
                args.dataset,
                model=settings.llm_model_high_tier,
                concurrency=args.concurrency,
            )
        finally:
            await provider.aclose()

    reports = asyncio.run(run())
    all_passed = _print_summary(reports)
    _print_gate_manifest()

    if args.persist:
        error = _persist_precheck(reports, args)
        if error:
            print(f"\n--persist refused: {error}", file=sys.stderr)
            return 3
        asyncio.run(_persist_baseline(reports[0], args))
        print(
            f"\npersisted baseline {args.calibration_version} for {reports[0].exam_type} "
            f"(writing calibration — WER/pronunciation still pending, Phase 2)"
        )

    if args.output:
        args.output.write_text(json.dumps([r.to_dict() for r in reports], indent=2))
        print(f"\nfull report written to {args.output}")

    if args.drift_check and asyncio.run(_run_drift_check(reports)):
        # Distinct exit code: a drift event isn't a gate failure — the run may
        # be green against the gates and still be worse than its own baseline.
        return 4

    # Needs both: every writing gate green AND every Phase 0 gate built. With
    # WER pending the best outcome is a WRITING GO, never a full GO (Brief §9).
    if not all_passed:
        print("\nGO/NO-GO: NO-GO — at least one exam type fails a writing gate")
        return 1
    if not full_phase0_ready():
        print(
            "\nGO/NO-GO: WRITING GATE ONLY — all writing gates met, but full Phase 0 is "
            "incomplete (WER/pronunciation pending, Phase 2). Not a launch GO."
        )
        return 1
    print("\nGO/NO-GO: GO candidate — all Phase 0 gates met")
    return 0


if __name__ == "__main__":
    sys.exit(main())
