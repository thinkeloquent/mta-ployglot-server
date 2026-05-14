import json
from pathlib import Path

import pytest

from app_yaml_from_context.deep_merge_null import deep_merge_with_null_replace

FIXTURE_PATH = Path(__file__).resolve().parents[3] / "parity" / "deep-merge-null.json"
FIXTURES = json.loads(FIXTURE_PATH.read_text())


@pytest.mark.parametrize("row", FIXTURES, ids=[r["name"] for r in FIXTURES])
def test_parity_row(row):
    result = deep_merge_with_null_replace(row["base"], row["override"])
    assert result == row["expected"]


def test_input_not_mutated():
    base = {"a": 1}
    override = {"a": 2}
    deep_merge_with_null_replace(base, override)
    assert base == {"a": 1}
    assert override == {"a": 2}


def test_returns_new_object():
    base = {"a": 1}
    result = deep_merge_with_null_replace(base, {})
    assert result is not base
    assert result == base


def test_parity_fixture_has_six_rows():
    assert len(FIXTURES) == 6
