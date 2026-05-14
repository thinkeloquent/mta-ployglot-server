import pytest

from polyglot_vault_file.env_store import EnvStore
from polyglot_vault_file.logger import Logger
from polyglot_vault_file.sdk import VaultFileSDK, VaultFileSDKBuilder


@pytest.fixture(autouse=True)
def _reset_store():
    EnvStore._reset_for_tests()
    yield
    EnvStore._reset_for_tests()


def test_setters():
    sdk = VaultFileSDK.create().build()
    alt = Logger.create("test", "sdk-setter-test")

    sdk.set_env_path("/tmp/x.env")
    sdk.set_base64_parsers({"raw": lambda s: s})
    sdk.set_logger(alt)

    assert sdk is not None


def test_builder_returns_builder():
    b = VaultFileSDK.create()
    assert isinstance(b, VaultFileSDKBuilder)


def test_builder_chain():
    logger = Logger.create("test", "builder-test")
    sdk = (
        VaultFileSDK.create()
        .with_env_path("/tmp/x.env")
        .with_base64_parsers({})
        .with_logger(logger)
        .build()
    )
    assert callable(sdk.load_config)


def test_builder_default_logger_fallback():
    sdk = VaultFileSDK.create().build()
    assert sdk._logger is not None


def test_export_to_format_stub():
    sdk = VaultFileSDK.create().build()
    r = sdk.export_to_format("json", "/tmp/x.json")
    assert r.success is False
    assert r.error is not None and r.error.code == "NOT_IMPLEMENTED"


def test_list_available_keys_stub():
    sdk = VaultFileSDK.create().build()
    r = sdk.list_available_keys()
    assert r.success is True
    assert r.data == []


def test_suggest_missing_keys_stub():
    sdk = VaultFileSDK.create().build()
    r = sdk.suggest_missing_keys("prefix")
    assert r.success is True
    assert r.data == []


def test_describe_config():
    sdk = VaultFileSDK.create().with_env_path(".env").build()
    r = sdk.describe_config()
    assert r.success is True
    assert r.data.source == ".env"
    assert isinstance(r.data.vars_count, int)


def test_diagnose_env_store_bug_fix():
    sdk = VaultFileSDK.create().build()
    sdk.load_config()
    r = sdk.diagnose_env_store()
    assert r.success is True
    assert r.data.initialized is True
    assert r.data.vars_loaded > 0


def test_validate_file_missing_valid_but_empty():
    sdk = VaultFileSDK.create().build()
    r = sdk.validate_file("/tmp/definitely-not-there.env")
    assert r.success is True
    assert r.data.valid is True
    assert "file parsed to empty map" in r.data.warnings


def test_validate_file_directory_invalid():
    sdk = VaultFileSDK.create().build()
    r = sdk.validate_file("/tmp")
    assert r.success is True
    assert r.data.valid is False


def test_get_secret_safe_missing():
    sdk = VaultFileSDK.create().build()
    sdk.load_config()
    r = sdk.get_secret_safe("DEFINITELY_NO_SUCH_KEY_XYZ")
    assert r.success is False
    assert r.error is not None and r.error.code == "KEY_NOT_FOUND"


def test_find_missing_required():
    sdk = VaultFileSDK.create().build()
    sdk.load_config()
    r = sdk.find_missing_required(["DEFINITELY_NO_A_XYZ", "DEFINITELY_NO_B_XYZ"])
    assert r.success is True
    assert r.data == ["DEFINITELY_NO_A_XYZ", "DEFINITELY_NO_B_XYZ"]


def test_load_config_on_missing_file_graceful():
    sdk = VaultFileSDK.create().with_env_path("/tmp/does-not-exist.env").build()
    r = sdk.load_config()
    assert r.success is True
    assert isinstance(r.data.total_vars_loaded, int)


def test_load_from_path_directory_fails_gracefully():
    sdk = VaultFileSDK.create().build()
    r = sdk.load_from_path("/tmp")
    assert r.success is False
    assert r.error is not None and r.error.code == "LOAD_FAILED"
