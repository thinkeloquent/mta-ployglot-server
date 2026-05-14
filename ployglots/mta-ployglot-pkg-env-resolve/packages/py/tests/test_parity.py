"""Cross-language parity contract — runs the shared fixture set against the Python ports."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from env_resolve import resolve, resolve_bool, resolve_float, resolve_int

from ._helpers import assert_eq

_FIXTURES_PATH = Path(__file__).resolve().parents[3] / "tests" / "parity" / "fixtures.json"
_DISPATCH = {
    "resolve": resolve,
    "resolve_bool": resolve_bool,
    "resolve_int": resolve_int,
    "resolve_float": resolve_float,
}


def _load_cases() -> list[dict[str, Any]]:
    payload = json.loads(_FIXTURES_PATH.read_text())
    return list(payload["cases"])


_CASES = _load_cases()


@pytest.mark.parametrize("case", _CASES, ids=[c["id"] for c in _CASES])
def test_parity_case(case: dict[str, Any], monkeypatch: pytest.MonkeyPatch) -> None:
    inputs = case["inputs"]
    for key, value in (inputs.get("env") or {}).items():
        monkeypatch.setenv(key, value)

    fn = _DISPATCH[case["function"]]
    result = fn(
        inputs["arg"],
        inputs["env_keys"],
        inputs["config"],
        inputs["config_key"],
        inputs["default"],
    )

    assert_eq(result, case["expected"], label=f"{case['id']}::{case.get('notes', '')}")
