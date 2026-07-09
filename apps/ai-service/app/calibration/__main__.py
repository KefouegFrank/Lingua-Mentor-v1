"""CLI for the Phase 0 calibration harness.

Usage:
    python -m app.calibration <dataset.jsonl> [--output report.json]
                              [--concurrency 4]

Requires GROQ_API_KEY (and the model tiers) from the environment/.env.
Prints a gate summary per exam type. Exit code 0 only if every exam type
passes every *implemented* writing gate — and even then the run is a WRITING
pass, not a full Phase 0 pass, while WER/pronunciation is unbuilt (Brief §9,
ADR 0006 §2.2). A partial pass is a no-go.
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

from app.calibration.harness import (
    CATEGORY_GATE,
    CEFR_GATE,
    OVERALL_GATE,
    full_phase0_ready,
    pending_gates,
    run_calibration,
)
from app.core.config import get_settings
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


def main() -> int:
    parser = argparse.ArgumentParser(prog="python -m app.calibration")
    parser.add_argument("dataset", type=Path, help="JSONL essay dataset (see harness.py docstring)")
    parser.add_argument("--output", type=Path, help="write full JSON report here")
    parser.add_argument("--concurrency", type=int, default=4)
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

    if args.output:
        args.output.write_text(json.dumps([r.to_dict() for r in reports], indent=2))
        print(f"\nfull report written to {args.output}")

    # Two independent conditions: every writing gate green, AND every Phase 0
    # gate actually built. While WER is pending, the best possible outcome is a
    # WRITING GO — never a full Phase 0 GO (Brief §9 partial-pass-is-a-no-go).
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
