"""Tests for merge_global_into_providers; iterates the shared parity fixture."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app_yaml_config.merge import merge_global_into_providers


REPO_ROOT = Path(__file__).resolve().parents[3]
FIXTURE = REPO_ROOT / "parity" / "globalize.json"


def _load_fixture():
    return json.loads(FIXTURE.read_text())


@pytest.mark.parametrize("row", _load_fixture(), ids=lambda r: r["name"])
def test_globalize_parity(row):
    assert merge_global_into_providers(row["input"]) == row["expected"]


def test_provider_keys_win_on_conflict():
    inp = {
        "global": {"timeout": 5000, "region": "us"},
        "providers": {"p": {"timeout": 1000}},
    }
    out = merge_global_into_providers(inp)
    assert out["providers"]["p"]["timeout"] == 1000
    assert out["providers"]["p"]["region"] == "us"


def test_does_not_mutate_input():
    inp = {"global": {"x": 1}, "providers": {"p": {}}}
    out = merge_global_into_providers(inp)
    out["providers"]["p"]["x"] = 999
    assert "x" not in inp["providers"]["p"]
