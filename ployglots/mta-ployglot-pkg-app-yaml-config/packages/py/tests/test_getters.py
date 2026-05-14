"""Tests for the read-only getters on AppYamlConfig."""

from __future__ import annotations

import asyncio
from collections import OrderedDict

import pytest

from app_yaml_config.core import AppYamlConfig


@pytest.fixture(autouse=True)
def _reset_singleton():
    AppYamlConfig._reset_for_testing()
    yield
    AppYamlConfig._reset_for_testing()


def _fixture():
    return OrderedDict(
        [
            (
                "a.yml",
                {
                    "global": {"region": "us", "timeout": 5000},
                    "providers": {"gemini": {"api_key": "g-key"}, "openai": {"timeout": 1000}},
                    "services": {"auth": {"url": "https://auth"}},
                },
            )
        ]
    )


def _init():
    return asyncio.run(AppYamlConfig.initialize(loaded=_fixture()))


def test_get_returns_top_level_value():
    inst = _init()
    assert inst.get("global") == {"region": "us", "timeout": 5000}


def test_get_returns_default_for_missing_key():
    inst = _init()
    assert inst.get("missing", 0) == 0


def test_get_returns_deep_clone():
    inst = _init()
    v = inst.get("global")
    v["region"] = "eu"
    assert inst.get("global")["region"] == "us"


def test_get_nested_walks_path():
    inst = _init()
    assert inst.get_nested(["providers", "gemini", "api_key"]) == "g-key"


def test_get_nested_returns_default_on_missing_node():
    inst = _init()
    assert inst.get_nested(["providers", "missing", "api_key"], 0) == 0


def test_get_all_returns_deep_clone():
    inst = _init()
    all_ = inst.get_all()
    all_["providers"]["gemini"]["api_key"] = "tampered"
    assert inst.get_nested(["providers", "gemini", "api_key"]) == "g-key"


def test_get_global_app_config_returns_deep_clone():
    inst = _init()
    g = inst.get_global_app_config()
    g["region"] = "eu"
    assert inst.get_global_app_config()["region"] == "us"


def test_get_global_app_config_returns_empty_when_global_absent():
    inst = asyncio.run(
        AppYamlConfig.initialize(loaded=OrderedDict([("x.yml", {"providers": {}})]))
    )
    assert inst.get_global_app_config() == {}
