from __future__ import annotations

import json
import os
from contextlib import contextmanager

import pytest

from app_yaml_loader.paths import resolve_app_env, resolve_config_dir
from tests.conftest import PARITY_DIR

with open(PARITY_DIR / "paths.json", encoding="utf-8") as fh:
    FIXTURE = json.load(fh)


@contextmanager
def patched_env(overrides: dict[str, str]):
    keys = ("CONFIG_DIR", "APP_ENV")
    saved = {k: os.environ.get(k) for k in keys}
    for k in keys:
        os.environ.pop(k, None)
    for k, v in overrides.items():
        os.environ[k] = v
    try:
        yield
    finally:
        for k in keys:
            os.environ.pop(k, None)
        for k, v in saved.items():
            if v is not None:
                os.environ[k] = v


@pytest.mark.parametrize("tc", FIXTURE["resolveConfigDir"], ids=lambda tc: tc["name"])
def test_resolve_config_dir(tc):
    override = tc["override"]
    caller_dir = tc.get("callerDir")
    with patched_env(tc.get("env", {})):
        if "expectedError" in tc:
            with pytest.raises(ValueError, match=tc["expectedError"]):
                resolve_config_dir(override, caller_dir)
        else:
            assert resolve_config_dir(override, caller_dir) == tc["expected"]


@pytest.mark.parametrize("tc", FIXTURE["resolveAppEnv"], ids=lambda tc: tc["name"])
def test_resolve_app_env(tc):
    with patched_env(tc.get("env", {})):
        assert resolve_app_env(tc["override"]) == tc["expected"]
