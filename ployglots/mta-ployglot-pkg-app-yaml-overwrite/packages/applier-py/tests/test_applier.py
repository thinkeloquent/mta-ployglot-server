import asyncio
import copy
import json
import os
from pathlib import Path

import pytest

from app_yaml_from_context.applier import apply_overwrites_from_context
from app_yaml_from_context.deep_merge_null import deep_merge_with_null_replace

FIXTURE_PATH = Path(__file__).resolve().parents[3] / "parity" / "applier-nested.json"
FIXTURE = json.loads(FIXTURE_PATH.read_text())


@pytest.fixture(autouse=True)
def _scrub_env():
    keys = ["TEST_KEY", "GEMINI_TIMEOUT"]
    for k in keys:
        os.environ.pop(k, None)
    yield
    for k in keys:
        os.environ.pop(k, None)


def _run(cfg, **kwargs):
    return asyncio.run(apply_overwrites_from_context(copy.deepcopy(cfg), **kwargs))


def test_top_level_overwrite_from_env():
    os.environ["TEST_KEY"] = "live-key"
    out = _run(FIXTURE, context={"request": {"host": "api.example.com"}})
    assert out["api_key"] == "live-key"


def test_nested_overwrite_from_context_with_env_default():
    os.environ["TEST_KEY"] = "k"
    out = _run(FIXTURE, context={"request": {"host": "api.example.com"}})
    assert out["providers"]["gemini"]["timeout"] == 5000


def test_nested_overwrite_from_context_resolves_request_host():
    os.environ["TEST_KEY"] = "k"
    out = _run(FIXTURE, context={"request": {"host": "api.example.com"}})
    assert out["services"]["x"]["url"] == "api.example.com"


def test_null_in_context_deletes_parent_key():
    os.environ["TEST_KEY"] = "k"
    out = _run(FIXTURE, context={"request": {"host": "h"}})
    assert "deprecated_field" not in out["services"]["x"]


def test_diagnostic_preservation():
    os.environ["TEST_KEY"] = "k"
    os.environ["GEMINI_TIMEOUT"] = "777"
    out = _run(FIXTURE, context={"request": {"host": "h"}})
    assert out["overwrite_from_env"] == {"api_key": "TEST_KEY"}
    assert out["providers"]["gemini"]["overwrite_from_context"] == {"timeout": "777"}
    assert out["services"]["x"]["overwrite_from_context"]["url"] == "h"
    assert out["services"]["x"]["overwrite_from_context"]["deprecated_field"] is None


def test_input_not_mutated():
    cfg = copy.deepcopy(FIXTURE)
    before = json.dumps(cfg, sort_keys=True)
    os.environ["TEST_KEY"] = "k"
    asyncio.run(apply_overwrites_from_context(cfg, context={"request": {"host": "h"}}))
    assert json.dumps(cfg, sort_keys=True) == before


class _UpperResolver:
    async def resolve(self, expr, *_):
        return expr.upper() if isinstance(expr, str) else expr

    async def resolve_object(self, obj, *_):
        if isinstance(obj, list):
            return [await self.resolve_object(v) for v in obj]
        if isinstance(obj, dict):
            return {k: await self.resolve_object(v) for k, v in obj.items()}
        if isinstance(obj, str):
            return obj.upper()
        return obj


def test_applier_with_hand_rolled_resolver():
    cfg = {
        "api_key": None,
        "overwrite_from_context": {"api_key": "fallback-key"},
    }
    out = asyncio.run(apply_overwrites_from_context(cfg, resolver=_UpperResolver()))
    assert out == {
        "api_key": "FALLBACK-KEY",
        "overwrite_from_context": {"api_key": "FALLBACK-KEY"},
    }


class _NoopResolver:
    async def resolve(self, expr, *_):
        return expr

    async def resolve_object(self, obj, *_):
        return obj


def test_walker_without_overwrites_returns_deep_clone():
    cfg = {"a": 1, "b": {"c": [1, 2]}, "d": "plain"}
    out = asyncio.run(apply_overwrites_from_context(cfg, resolver=_NoopResolver()))
    assert out == cfg
    assert out is not cfg


def test_arrays_preserved():
    cfg = {"items": [1, 2, 3]}
    out = asyncio.run(apply_overwrites_from_context(cfg, resolver=_NoopResolver()))
    assert isinstance(out["items"], list)
    assert out["items"] == [1, 2, 3]


def test_deep_merge_with_null_replace_exported():
    assert callable(deep_merge_with_null_replace)
