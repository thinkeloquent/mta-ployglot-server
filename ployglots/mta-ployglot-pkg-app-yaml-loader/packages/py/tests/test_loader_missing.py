from __future__ import annotations

import logging

import pytest

from app_yaml_loader.cache import clear_cache
from app_yaml_loader.errors import LoadError
from app_yaml_loader.loader import load_files
from tests.conftest import PARITY_DIR

FIXTURES = PARITY_DIR / "fixtures" / "yaml"


@pytest.fixture(autouse=True)
def _reset_cache():
    clear_cache()
    yield
    clear_cache()


def test_default_raises_on_missing_file():
    with pytest.raises(LoadError):
        load_files([str(FIXTURES / "does-not-exist.yml")])


def test_skip_omits_entry_and_warns(caplog):
    a = str(FIXTURES / "a.yml")
    missing = str(FIXTURES / "does-not-exist.yml")
    with caplog.at_level(logging.WARNING, logger="app_yaml_loader"):
        out = load_files([a, missing], missing="skip")
    assert list(out.keys()) == [a]
    assert any("does-not-exist.yml" in rec.getMessage() for rec in caplog.records)


def test_invalid_missing_strategy_raises_immediately():
    with pytest.raises(ValueError, match="Invalid missing strategy"):
        load_files(["/x.yml"], missing="foo")  # type: ignore[arg-type]
