from __future__ import annotations

import os

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


def test_happy_path_two_files_in_order():
    a = str(FIXTURES / "a.yml")
    b = str(FIXTURES / "b.yml")
    out = load_files([a, b])
    assert list(out.keys()) == [a, b]
    assert out[a]["name"] == "alpha"
    assert out[b]["nested"]["key"] == "value"


def test_empty_file_yields_empty_dict():
    e = str(FIXTURES / "empty.yml")
    out = load_files([e])
    assert out[e] == {}


def test_parse_error_wraps_in_load_error():
    bad = str(FIXTURES / "invalid.yml")
    with pytest.raises(LoadError) as ei:
        load_files([bad])
    assert ei.value.path == bad


def test_non_string_path_raises_type_error():
    with pytest.raises(TypeError):
        load_files([42])  # type: ignore[list-item]


def test_relative_paths_resolve_to_absolute_keys(tmp_path, monkeypatch):
    abs_path = str(FIXTURES / "a.yml")
    monkeypatch.chdir(os.path.dirname(abs_path))
    out = load_files(["a.yml"])
    assert list(out.keys())[0] == abs_path
