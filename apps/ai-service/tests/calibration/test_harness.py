"""Calibration harness tests — scripted provider, no network."""

import json
from decimal import Decimal

import pytest

from app.calibration.harness import (
    CalibrationEssay,
    build_report,
    load_dataset,
    run_calibration,
    score_dataset,
)
from tests.engines.writing_evaluation.test_engine import FakeProvider

pytestmark = pytest.mark.asyncio


def _payload(tr, cc, lr, gra):
    return json.dumps(
        {
            "categories": [
                {"key": "task_response", "score": tr, "feedback": "x"},
                {"key": "coherence_cohesion", "score": cc, "feedback": "x"},
                {"key": "lexical_resource", "score": lr, "feedback": "x"},
                {"key": "grammatical_range_accuracy", "score": gra, "feedback": "x"},
            ]
        }
    )


def _essay(essay_id, human_overall, categories):
    return CalibrationEssay(
        essay_id=essay_id,
        exam_type="ielts_academic",
        prompt_text="p",
        essay_text="e",
        human_overall=Decimal(human_overall),
        human_categories={k: Decimal(v) for k, v in categories.items()},
    )


HUMAN_CATS = [
    {"task_response": "5.0", "coherence_cohesion": "5.0", "lexical_resource": "5.5", "grammatical_range_accuracy": "5.0"},
    {"task_response": "6.0", "coherence_cohesion": "6.0", "lexical_resource": "6.5", "grammatical_range_accuracy": "6.0"},
    {"task_response": "7.0", "coherence_cohesion": "7.0", "lexical_resource": "7.5", "grammatical_range_accuracy": "7.0"},
    {"task_response": "8.0", "coherence_cohesion": "8.0", "lexical_resource": "8.0", "grammatical_range_accuracy": "8.0"},
]


async def test_perfect_agreement_gives_r_1():
    """AI scores mirror human scores exactly → r = 1.0 overall and per category."""
    essays = [
        _essay("e1", "5.0", HUMAN_CATS[0]),
        _essay("e2", "6.0", HUMAN_CATS[1]),
        _essay("e3", "7.0", HUMAN_CATS[2]),
        _essay("e4", "8.0", HUMAN_CATS[3]),
    ]
    provider = FakeProvider(
        [
            _payload(5.0, 5.0, 5.5, 5.0),
            _payload(6.0, 6.0, 6.5, 6.0),
            _payload(7.0, 7.0, 7.5, 7.0),
            _payload(8.0, 8.0, 8.0, 8.0),
        ]
    )
    # concurrency=1 keeps the scripted responses aligned with essay order.
    scores, failures = await score_dataset(provider, essays, model="m", concurrency=1)
    assert failures == []
    report = build_report("ielts_academic", scores, 0)
    assert report.overall_pearson == pytest.approx(1.0)
    assert all(r == pytest.approx(1.0) for r in report.category_pearson.values())
    assert report.overall_gate_passed
    assert report.categories_below_gate == []
    assert report.divergent_essays == []


async def test_divergent_essays_flagged_and_failures_recorded():
    essays = [
        _essay("good", "5.0", HUMAN_CATS[0]),
        _essay("divergent", "6.0", HUMAN_CATS[1]),
        _essay("broken", "7.0", HUMAN_CATS[2]),
    ]
    provider = FakeProvider(
        [
            _payload(5.0, 5.0, 5.0, 5.0),
            _payload(8.0, 8.0, 8.0, 8.0),  # 2 bands above human → divergent
            "{malformed", "{still malformed",  # fails after retry → recorded failure
        ]
    )
    scores, failures = await score_dataset(provider, essays, model="m", concurrency=1)
    assert len(scores) == 2
    assert [f["essay_id"] for f in failures] == ["broken"]
    report = build_report("ielts_academic", scores, len(failures))
    assert [d["essay_id"] for d in report.divergent_essays] == ["divergent"]
    assert report.failed_count == 1


async def test_run_calibration_groups_by_exam_type(tmp_path):
    dataset = tmp_path / "essays.jsonl"
    records = [
        {"essay_id": "a", "exam_type": "ielts_academic", "prompt_text": "p", "essay_text": "e",
         "human_overall": "5.0", "human_categories": HUMAN_CATS[0]},
        {"essay_id": "b", "exam_type": "ielts_academic", "prompt_text": "p", "essay_text": "e",
         "human_overall": "7.0", "human_categories": HUMAN_CATS[2]},
    ]
    dataset.write_text("\n".join(json.dumps(r) for r in records))
    provider = FakeProvider([_payload(5.0, 5.0, 5.5, 5.0), _payload(7.0, 7.0, 7.5, 7.0)])
    reports = await run_calibration(provider, dataset, model="m", concurrency=1)
    assert len(reports) == 1
    assert reports[0].exam_type == "ielts_academic"
    assert reports[0].sample_count == 2


def test_load_dataset_reports_bad_line(tmp_path):
    dataset = tmp_path / "bad.jsonl"
    dataset.write_text('{"essay_id": "a"}\n')
    with pytest.raises(ValueError, match="bad.jsonl:1"):
        load_dataset(dataset)
