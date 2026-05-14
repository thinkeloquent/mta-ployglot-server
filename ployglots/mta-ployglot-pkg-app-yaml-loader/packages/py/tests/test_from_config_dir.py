from __future__ import annotations

import os.path

import pytest

from app_yaml_loader.cache import clear_cache
from app_yaml_loader.loader import load_from_config_dir
from tests.conftest import PARITY_DIR

CANONICAL = str(PARITY_DIR / "fixtures" / "canonical-config")


@pytest.fixture(autouse=True)
def _reset_cache():
    clear_cache()
    yield
    clear_cache()


def test_load_from_config_dir_returns_six_keys_in_canonical_order():
    out = load_from_config_dir(config_dir=CANONICAL, app_env="test")
    keys = [os.path.basename(k) for k in out.keys()]
    assert keys == [
        "base.yml",
        "security.yml",
        "api-release-date.yml",
        "feature_flags.yml",
        "server.test.yaml",
        "endpoint.test.yaml",
    ]
    base = next(iter(out.values()))
    assert base["global"]["layer"] == "base"


def test_base_files_empty_returns_only_env_suffixed():
    out = load_from_config_dir(config_dir=CANONICAL, app_env="test", base_files=[])
    keys = [os.path.basename(k) for k in out.keys()]
    assert keys == ["server.test.yaml", "endpoint.test.yaml"]
