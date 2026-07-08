"""Every shipped exam YAML must load, validate, and map CEFR correctly."""

from decimal import Decimal

import pytest

from app.engines.writing_evaluation.exam_config import (
    EXAMS_DIR,
    UnknownExamError,
    load_exam_config,
)

ALL_EXAM_IDS = sorted(p.stem for p in EXAMS_DIR.glob("*.yaml"))


def test_all_phase1_exams_present():
    assert ALL_EXAM_IDS == [
        "delf_b1",
        "delf_b2",
        "ielts_academic",
        "ielts_general",
        "toefl_ibt",
    ]


@pytest.mark.parametrize("exam_id", ALL_EXAM_IDS)
def test_exam_config_loads_and_weights_sum(exam_id):
    config = load_exam_config(exam_id)
    assert config.exam_id == exam_id
    total = sum(c.weight for c in config.writing.rubric_categories)
    assert abs(total - Decimal("1")) <= Decimal("0.005")
    # Every category carries descriptors for bands 5–8 (Brief §5.3 anchors).
    for category in config.writing.rubric_categories:
        assert {"5", "6", "7", "8"} <= set(category.band_descriptors)


def test_toefl_has_three_categories_per_official_rubric():
    assert len(load_exam_config("toefl_ibt").writing.rubric_categories) == 3


def test_cefr_mapping_ielts():
    """Thresholds from Master PRD §7.3."""
    config = load_exam_config("ielts_academic")
    cases = [
        (Decimal("2.5"), None),
        (Decimal("3.0"), "A2"),
        (Decimal("4.5"), "B1"),
        (Decimal("6.5"), "B2"),
        (Decimal("7.0"), "C1"),
        (Decimal("9.0"), "C2"),
    ]
    for score, expected in cases:
        assert config.writing.cefr_for(score) == expected, score


def test_unknown_exam_raises():
    with pytest.raises(UnknownExamError, match="hsk"):
        load_exam_config("hsk")
