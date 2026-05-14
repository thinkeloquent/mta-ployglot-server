"""Tests for AppYamlConfig lifecycle (initialize / getInstance / restore)."""

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


def _loaded_fixture():
    return OrderedDict(
        [
            ("a.yml", {"x": 1, "global": {"timeout": 5000}, "providers": {"gemini": {}}}),
            ("b.yml", {"y": 2}),
        ]
    )


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro) if False else asyncio.run(coro)


def test_initialize_loaded_populates_state():
    inst = _run(AppYamlConfig.initialize(loaded=_loaded_fixture()))
    assert inst.get("x") == 1
    assert inst.get("y") == 2
    assert inst.get_nested(["providers", "gemini"]) == {"timeout": 5000}


def test_re_initialize_returns_same_instance():
    a = _run(AppYamlConfig.initialize(loaded=_loaded_fixture()))
    b = _run(AppYamlConfig.initialize(loaded=OrderedDict([("z.yml", {"z": 99})])))
    assert a is b
    assert b.get("z", "(none)") == "(none)"


def test_get_instance_before_init_raises():
    with pytest.raises(RuntimeError, match="not initialized"):
        AppYamlConfig.get_instance()


def test_get_instance_after_init_returns_singleton():
    inst = _run(AppYamlConfig.initialize(loaded=_loaded_fixture()))
    assert AppYamlConfig.get_instance() is inst


def test_reset_for_testing_clears_singleton_ref():
    _run(AppYamlConfig.initialize(loaded=_loaded_fixture()))
    AppYamlConfig._reset_for_testing()
    with pytest.raises(RuntimeError):
        AppYamlConfig.get_instance()


def test_initialize_without_input_or_loader_raises():
    with pytest.raises((RuntimeError, ValueError)) as excinfo:
        _run(AppYamlConfig.initialize())
    # Loader almost certainly not installed in test env -> RuntimeError naming the package.
    msg = str(excinfo.value)
    assert "app_yaml_loader" in msg or "needs one of" in msg


def test_snapshot_is_separate_object_from_config():
    inst = _run(AppYamlConfig.initialize(loaded=_loaded_fixture()))
    assert inst._config is not inst._initial_merged_config
    assert inst._config == inst._initial_merged_config


def test_restore_returns_config_to_snapshot():
    inst = _run(AppYamlConfig.initialize(loaded=_loaded_fixture()))
    before = inst.get_all()
    inst._config["x"] = 999
    assert inst.get("x") == 999
    inst.restore()
    assert inst.get_all() == before
    assert inst.get("x") == 1


def test_mutating_config_does_not_affect_snapshot():
    inst = _run(AppYamlConfig.initialize(loaded=_loaded_fixture()))
    inst._config["x"] = 999
    assert inst._initial_merged_config["x"] == 1
