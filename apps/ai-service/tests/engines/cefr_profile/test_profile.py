"""4D CEFR profile logic — pure, no DB/network. Enforces the §22.1 source rules
and the honest handling of the skills Phase 1 can't yet assess."""

from app.engines.cefr_profile import (
    placement_profile,
    profile_from_stored,
    reading_proxy_from_writing,
)


def test_reading_proxy_mirrors_writing():
    assert reading_proxy_from_writing("B2") == "B2"
    assert reading_proxy_from_writing("C1") == "C1"


def test_reading_proxy_of_missing_or_invalid_is_none():
    assert reading_proxy_from_writing(None) is None
    assert reading_proxy_from_writing("Z9") is None


def test_placement_profile_writing_assessed_reading_proxied():
    p = placement_profile("B2")
    assert p.writing.level == "B2"
    assert p.writing.source == "assessed"
    assert p.reading.level == "B2"  # proxy mirrors writing
    assert p.reading.source == "proxy"


def test_placement_profile_speaking_and_listening_pending_on_voice():
    """The two skills that need the (unbuilt) Voice pipeline must read as
    pending with no fabricated level — that honesty is the point of §22."""
    p = placement_profile("B2")
    assert p.speaking.level is None
    assert p.speaking.source == "pending"
    assert "Phase 2" in p.speaking.note
    assert p.listening.level is None
    assert p.listening.source == "pending"


def test_profile_from_stored_marks_unset_skills_pending():
    p = profile_from_stored(
        cefr_writing="C1", cefr_reading="C1", cefr_speaking=None, cefr_listening=None
    )
    assert p.writing.source == "assessed" and p.writing.level == "C1"
    assert p.reading.source == "proxy"
    assert p.speaking.source == "pending" and p.speaking.level is None
    assert p.listening.source == "pending"


def test_profile_from_stored_reflects_a_populated_speaking_skill():
    # When the Voice pipeline eventually writes speaking, it reads as assessed.
    p = profile_from_stored(
        cefr_writing="B2", cefr_reading="B2", cefr_speaking="B1", cefr_listening="A2"
    )
    assert p.speaking.source == "assessed" and p.speaking.level == "B1"
    assert p.listening.source == "proxy" and p.listening.level == "A2"


def test_to_dict_shape():
    d = placement_profile("B1").to_dict()
    assert set(d) == {"speaking", "listening", "reading", "writing"}
    assert set(d["writing"]) == {"level", "source", "note"}
