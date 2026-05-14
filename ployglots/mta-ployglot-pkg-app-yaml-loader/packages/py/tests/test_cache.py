from __future__ import annotations

from unittest.mock import patch

import pytest

from app_yaml_loader import _io
from app_yaml_loader.cache import cache_get, cache_set, clear_cache, is_miss
from app_yaml_loader.loader import load_files
from tests.conftest import PARITY_DIR

FIXTURES = PARITY_DIR / "fixtures" / "yaml"


@pytest.fixture(autouse=True)
def _reset_cache():
    clear_cache()
    yield
    clear_cache()


def test_cache_miss_reads_disk_cache_hit_does_not():
    target = str(FIXTURES / "a.yml")
    with patch.object(_io, "read_text", wraps=_io.read_text) as spy:
        load_files([target])
        load_files([target])
    assert spy.call_count == 1


def test_clone_on_read_isolates_callers():
    cache_set("/k", {"a": 1, "nested": {"b": 2}})
    v1 = cache_get("/k")
    v1["nested"]["b"] = 999
    v2 = cache_get("/k")
    assert v2["nested"]["b"] == 2


def test_clear_cache_returns_prior_size_and_empties_store():
    cache_set("/a", {})
    cache_set("/b", {})
    assert clear_cache() == 2
    assert is_miss(cache_get("/a"))


def test_clear_cache_path_returns_one_if_present_zero_if_absent():
    cache_set("/a", {})
    assert clear_cache("/a") == 1
    assert clear_cache("/a") == 0
