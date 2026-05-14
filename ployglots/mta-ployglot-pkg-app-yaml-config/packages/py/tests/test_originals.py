"""Tests for getOriginal / getOriginalAll on AppYamlConfig."""

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
            ("a.yml", {"x": 1}),
            ("b.yml", {"y": 2, "providers": {"p": {"api_key": "k"}}}),
        ]
    )


def test_get_original_returns_deep_clone():
    inst = asyncio.run(AppYamlConfig.initialize(loaded=_fixture()))
    orig = inst.get_original("b.yml")
    assert orig == {"y": 2, "providers": {"p": {"api_key": "k"}}}
    orig["providers"]["p"]["api_key"] = "tampered"
    assert inst.get_original("b.yml")["providers"]["p"]["api_key"] == "k"


def test_get_original_returns_none_for_absent_file():
    inst = asyncio.run(AppYamlConfig.initialize(loaded=_fixture()))
    assert inst.get_original("missing.yml") is None


def test_get_original_all_returns_dict_of_clones():
    inst = asyncio.run(AppYamlConfig.initialize(loaded=_fixture()))
    all_ = inst.get_original_all()
    assert len(all_) == 2
    all_["a.yml"]["x"] = 999
    assert inst.get_original("a.yml")["x"] == 1
