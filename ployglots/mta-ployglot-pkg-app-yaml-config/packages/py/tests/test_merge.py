"""Tests for deep_merge / merge_files; iterates the shared parity fixture."""

from __future__ import annotations

import json
from collections import OrderedDict
from pathlib import Path

import pytest

from app_yaml_config.merge import deep_merge, merge_files


REPO_ROOT = Path(__file__).resolve().parents[3]
FIXTURE = REPO_ROOT / "parity" / "merge.json"


def _load_fixture():
    return json.loads(FIXTURE.read_text())


@pytest.mark.parametrize("row", _load_fixture(), ids=lambda r: r["name"])
def test_deep_merge_parity(row):
    assert deep_merge(row["base"], row["override"]) == row["expected"]


def test_deep_merge_does_not_alias_source():
    base = {"a": {"b": 1}}
    override = {"a": {"c": 2}}
    out = deep_merge(base, override)
    out["a"]["b"] = 999
    assert base["a"]["b"] == 1


def test_merge_files_empty_map_returns_empty():
    assert merge_files(OrderedDict()) == {}


def test_merge_files_none_input():
    assert merge_files(None) == {}


def test_merge_files_later_priority():
    loaded = OrderedDict(
        [
            ("a.yml", {"x": 1, "y": {"p": 1}}),
            ("b.yml", {"x": 2, "y": {"q": 2}}),
        ]
    )
    assert merge_files(loaded) == {"x": 2, "y": {"p": 1, "q": 2}}


def test_merge_files_tolerates_none_parsed():
    loaded = OrderedDict([("a.yml", {"x": 1}), ("b.yml", None)])
    assert merge_files(loaded) == {"x": 1}
