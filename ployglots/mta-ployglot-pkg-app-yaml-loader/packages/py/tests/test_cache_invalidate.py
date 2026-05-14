from __future__ import annotations

from unittest.mock import patch

import pytest

from app_yaml_loader import _io
from app_yaml_loader.cache import clear_cache
from app_yaml_loader.loader import load_files
from tests.conftest import PARITY_DIR

FIXTURES = PARITY_DIR / "fixtures" / "yaml"


@pytest.fixture(autouse=True)
def _reset_cache():
    clear_cache()
    yield
    clear_cache()


def test_force_true_re_reads_disk_even_when_cached():
    target = str(FIXTURES / "a.yml")
    with patch.object(_io, "read_text", wraps=_io.read_text) as spy:
        load_files([target])
        load_files([target], force=True)
    assert spy.call_count == 2


def test_clear_cache_path_evicts_then_re_reads():
    target = str(FIXTURES / "a.yml")
    with patch.object(_io, "read_text", wraps=_io.read_text) as spy:
        load_files([target])
        clear_cache(str(FIXTURES / "a.yml"))
        load_files([target])
    assert spy.call_count == 2


def test_clear_cache_no_arg_returns_prior_size():
    load_files([str(FIXTURES / "a.yml"), str(FIXTURES / "b.yml")])
    assert clear_cache() == 2


def test_clear_cache_importable_from_package_main():
    import app_yaml_loader

    assert callable(app_yaml_loader.clear_cache)
