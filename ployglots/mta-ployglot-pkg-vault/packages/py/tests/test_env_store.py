import os

import pytest

from polyglot_vault_file.env_store import EnvStore
from polyglot_vault_file.validators import EnvKeyNotFoundError


@pytest.fixture(autouse=True)
def _reset_store():
    EnvStore._reset_for_tests()
    yield
    EnvStore._reset_for_tests()


def test_missing_file_continues():
    r = EnvStore.on_startup("/tmp/definitely-not-there.env")
    assert isinstance(r.total_vars_loaded, int)
    assert EnvStore.is_initialized() is True


def test_parse_error_reraised(tmp_path):
    with pytest.raises(Exception):
        EnvStore.on_startup(str(tmp_path))  # tmp_path is a dir, forces error


def test_get_env_only_key():
    os.environ["TEST_ENV_ONLY_KEY_PY"] = "from-env"
    try:
        EnvStore.on_startup("/tmp/x.env")
        assert EnvStore.get("TEST_ENV_ONLY_KEY_PY") == "from-env"
    finally:
        del os.environ["TEST_ENV_ONLY_KEY_PY"]


def test_get_default_when_absent():
    EnvStore.on_startup("/tmp/x.env")
    assert EnvStore.get("DEFINITELY_UNSET_KEY_PY", "fallback") == "fallback"


def test_get_or_throw_empty_key_message():
    with pytest.raises(ValueError) as exc_info:
        EnvStore.get_or_throw("")
    assert str(exc_info.value) == "Key is required"


def test_get_or_throw_missing_raises_env_key_not_found():
    EnvStore.on_startup("/tmp/x.env")
    with pytest.raises(EnvKeyNotFoundError) as exc_info:
        EnvStore.get_or_throw("DEFINITELY_NOT_SET_XYZ")
    assert exc_info.value.key == "DEFINITELY_NOT_SET_XYZ"


def test_is_initialized_false_before():
    assert EnvStore.is_initialized() is False


def test_is_initialized_true_after():
    EnvStore.on_startup("/tmp/does-not-exist.env")
    assert EnvStore.is_initialized() is True
