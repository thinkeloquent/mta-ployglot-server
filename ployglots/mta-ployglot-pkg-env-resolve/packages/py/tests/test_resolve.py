"""Per-language tests for env_resolve.resolve — language-specific edge cases."""

from __future__ import annotations

import pytest

from env_resolve import resolve


def test_arg_tier_returns_arg_directly() -> None:
    assert resolve("hi", "X", {"x": "cfg"}, "x", "DEFAULT") == "hi"


def test_env_tier_first_match_from_list(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DB_URL", "postgres://primary")
    assert (
        resolve(None, ["MISSING_A", "DB_URL", "MISSING_B"], None, None, "DEFAULT")
        == "postgres://primary"
    )


def test_env_tier_string_form(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("REGION", "us-west-2")
    assert resolve(None, "REGION", None, None, "DEFAULT") == "us-west-2"


def test_config_tier_returns_zero_value() -> None:
    # Critical: 0 is a valid value, not "missing".
    assert resolve(None, None, {"port": 0}, "port", 80) == 0


def test_config_tier_skips_explicit_none_d3() -> None:
    # D3: {key: None} falls through to default.
    assert resolve(None, None, {"x": None}, "x", "DEFAULT") == "DEFAULT"


def test_default_fallthrough() -> None:
    assert resolve(None, None, None, None, "DEFAULT") == "DEFAULT"


def test_empty_string_env_key_skipped(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("REAL_KEY", "found")
    assert resolve(None, ["", "REAL_KEY"], None, None, "DEFAULT") == "found"


def test_env_keys_none_short_circuits_d7() -> None:
    # D7: env_keys=None must not raise; falls through to config tier.
    assert resolve(None, None, {"k": "from-cfg"}, "k", "DEFAULT") == "from-cfg"
