"""CLI for the Phase 0 calibration harness.

Usage:
    python -m app.calibration <dataset.jsonl> [--output report.json]
                              [--concurrency 4]

Requires GROQ_API_KEY (and the model tiers) from the environment/.env.
Prints a gate summary per exam type; exit code 0 only if every exam type
passes the overall gate — a partial pass is a no-go (Brief §9).
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

from app.calibration.harness import CATEGORY_GATE, OVERALL_GATE, run_calibration
from app.core.config import get_settings
from app.providers.llm.groq_provider import GroqProvider


def _print_summary(reports) -> bool:
    all_passed = True
    for report in reports:
        gate = "PASS" if report.overall_gate_passed else "FAIL"
        all_passed &= report.overall_gate_passed
        print(f"\n=== {report.exam_type} ===")
        print(f"  essays scored : {report.sample_count} ({report.failed_count} failed)")
        print(f"  overall r     : {report.overall_pearson:.4f}  (gate {OVERALL_GATE}) [{gate}]")
        for key, r in sorted(report.category_pearson.items()):
            flag = "" if r >= CATEGORY_GATE else f"  <-- below {CATEGORY_GATE}, tune this rubric"
            print(f"  {key:<28}: {r:.4f}{flag}")
        if report.divergent_essays:
            print(f"  divergent (>1.0 band): {len(report.divergent_essays)} — review these for tuning")
    return all_passed


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

    if args.output:
        args.output.write_text(json.dumps([r.to_dict() for r in reports], indent=2))
        print(f"\nfull report written to {args.output}")

    print(f"\nGO/NO-GO: {'GO candidate — all overall gates met' if all_passed else 'NO-GO — at least one exam type below 0.85'}")
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
