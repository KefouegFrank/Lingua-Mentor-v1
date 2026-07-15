"""CLI: raw per-rater graded data → clean, IRR-gated calibration dataset.

Usage:
    python -m app.calibration.ingest <raw.jsonl> [--out clean.jsonl]

Reads the grading protocol's output (two/three examiner scores per essay),
resolves consensus, and gates the set on inter-rater reliability (Brief §6.1).
Writes the clean dataset the scoring harness consumes:

    python -m app.calibration.ingest raw.jsonl --out clean.jsonl
    python -m app.calibration            clean.jsonl   # then score it

Exit code 0 only if the reliability gate passes and nothing is stuck awaiting
adjudication — otherwise the set isn't ready to calibrate against.
"""

import argparse
import json
import sys
from pathlib import Path

from app.calibration.irr import IRR_GATE, ingest, load_raw_dataset


def _print_report(result) -> None:
    print("=== IRR ingestion ===")
    print(f"  processed (continuous-band): {result.processed_count}")
    print(f"  clean essays emitted       : {len(result.clean_essays)}")

    if result.irr_overall is None:
        print("  inter-rater reliability    : n/a (need >= 2 essays)")
    else:
        flag = "PASS" if result.irr_gate_passed else "FAIL"
        print(
            f"  inter-rater reliability (r): {result.irr_overall:.4f}  (gate {IRR_GATE}) [{flag}]"
        )
    for key, r in sorted(result.irr_per_category.items()):
        print(f"    {key:<28}: {r:.4f}")

    if result.spot_review_ids:
        print(
            f"  spot_review (0.5–1.0 band): {len(result.spot_review_ids)} — "
            f"Lead Examiner must clear before sign-off: {', '.join(result.spot_review_ids)}"
        )
    if result.adjudicated_ids:
        print(
            f"  adjudicated (>1.0 band)   : {len(result.adjudicated_ids)} — "
            f"{', '.join(result.adjudicated_ids)}"
        )
    if result.excluded:
        print(f"  EXCLUDED (unresolved)     : {len(result.excluded)}")
        for ex in result.excluded:
            print(f"      {ex['essay_id']}: {ex['reason']}")
    if result.deferred:
        print(f"  deferred (non-continuous) : {len(result.deferred)}")
        for d in result.deferred:
            print(f"      {d['essay_id']} [{d['exam_type']}]: {d['reason']}")


def main() -> int:
    parser = argparse.ArgumentParser(prog="python -m app.calibration.ingest")
    parser.add_argument("dataset", type=Path, help="raw per-rater JSONL (see irr.py docstring)")
    parser.add_argument("--out", type=Path, help="write the clean calibration dataset here")
    args = parser.parse_args()

    result = ingest(load_raw_dataset(args.dataset))
    _print_report(result)

    if args.out:
        args.out.write_text("\n".join(json.dumps(e) for e in result.clean_essays) + "\n")
        print(f"\nclean dataset ({len(result.clean_essays)} essays) written to {args.out}")

    if not result.ready:
        why = []
        if not result.irr_gate_passed:
            why.append(f"reliability below {IRR_GATE}")
        if result.excluded:
            why.append(f"{len(result.excluded)} essay(s) awaiting adjudication")
        print(f"\nNOT READY: {', '.join(why)} — resolve before calibrating.", file=sys.stderr)
        return 1
    print("\nREADY: reliability met, no unresolved essays — safe to score.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
