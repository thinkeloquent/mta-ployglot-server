"""Tests for AppYamlConfigSDK."""

from __future__ import annotations

import asyncio
from collections import OrderedDict

import pytest

from app_yaml_config.core import AppYamlConfig
from app_yaml_config.sdk import AppYamlConfigSDK


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
                    "global": {"region": "us"},
                    "providers": {"gemini": {"api_key": "g-key"}, "openai": {}},
                    "services": {"auth": {}},
                    "storage": {"redis": {}},
                },
            )
        ]
    )


def _build_sdk():
    asyncio.run(AppYamlConfig.initialize(loaded=_fixture()))
    return AppYamlConfigSDK(AppYamlConfig.get_instance())


def test_get_all_returns_deep_clone():
    sdk = _build_sdk()
    all_ = sdk.get_all()
    all_["providers"]["gemini"]["api_key"] = "tampered"
    assert sdk.get("providers.gemini.api_key") == "g-key"


def test_list_helpers():
    sdk = _build_sdk()
    assert sorted(sdk.list_providers()) == ["gemini", "openai"]
    assert sdk.list_services() == ["auth"]
    assert sdk.list_storages() == ["redis"]


def test_list_helpers_empty_when_absent():
    asyncio.run(AppYamlConfig.initialize(loaded=OrderedDict([("a.yml", {"x": 1})])))
    sdk = AppYamlConfigSDK(AppYamlConfig.get_instance())
    assert sdk.list_providers() == []
    assert sdk.list_services() == []
    assert sdk.list_storages() == []


def test_dot_path_get_returns_nested():
    sdk = _build_sdk()
    assert sdk.get("providers.gemini.api_key") == "g-key"
    assert sdk.get("providers.gemini.api_key", "(none)") == "g-key"


def test_dot_path_get_default_for_missing_path():
    sdk = _build_sdk()
    assert sdk.get("missing.x.y", 0) == 0
    assert sdk.get("providers.missing", "x") == "x"


def test_from_directory_error_names_loader():
    with pytest.raises(RuntimeError, match="app_yaml_loader"):
        asyncio.run(AppYamlConfigSDK.from_directory("./nonexistent"))
