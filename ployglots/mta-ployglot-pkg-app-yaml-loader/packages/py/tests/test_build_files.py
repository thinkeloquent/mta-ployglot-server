from __future__ import annotations

import json

import pytest

from app_yaml_loader.paths import build_config_files
from tests.conftest import PARITY_DIR

with open(PARITY_DIR / "build-config-files.json", encoding="utf-8") as fh:
    CASES = json.load(fh)


@pytest.mark.parametrize("tc", CASES, ids=lambda tc: tc["name"])
def test_build_config_files(tc):
    got = build_config_files(
        tc["configDir"],
        tc["appEnv"],
        tc.get("baseFiles"),
        tc.get("envSuffixes"),
    )
    assert got == tc["expected"]
