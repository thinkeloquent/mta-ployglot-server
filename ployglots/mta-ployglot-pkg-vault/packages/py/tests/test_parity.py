"""Parity invariants — py twin of packages/ts/tests/parity.test.ts."""
from __future__ import annotations

import os
import re
from pathlib import Path

import pytest

from polyglot_vault_file import (
    EnvStore,
    VaultFileSDK,
    EnvKeyNotFoundError,
    VaultHeader,
    from_json,
)
from polyglot_vault_file.sdk_types import SDKError


FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(autouse=True)
def _shared_env():
    EnvStore._reset_for_tests()
    os.environ["SHARED"] = "env-value"
    EnvStore.on_startup(str(FIXTURES / ".env.mixed"))
    yield
    os.environ.pop("SHARED", None)
    EnvStore._reset_for_tests()


def test_01_get_priority_store_wins():
    assert EnvStore.get("SHARED") == "file-value"


def test_02_on_startup_is_synchronous():
    r = EnvStore.on_startup(str(FIXTURES / ".env.mixed"))
    assert not hasattr(r, "__await__")
    assert isinstance(r.total_vars_loaded, int)


def test_03_load_result_wire_is_camelcase():
    r = EnvStore.on_startup(str(FIXTURES / ".env.mixed"))
    assert '"totalVarsLoaded"' in r.model_dump_json(by_alias=True)


def test_04_from_json_returns_validated_vaultfile():
    raw = (FIXTURES / "vault.valid.json").read_text()
    vf = from_json(raw)
    assert vf.header.version == "1.0.0"
    assert vf.secrets["SHARED"] == "file-value"


def test_05_env_key_not_found_error_has_key_attr():
    e = EnvKeyNotFoundError("X")
    assert e.key == "X"


def test_06_env_key_not_found_error_message():
    assert str(EnvKeyNotFoundError("X")) == "Environment variable 'X' not found"


def test_07_sdk_error_is_named():
    e = SDKError(code="C", message="M")
    assert e.code == "C" and e.message == "M"


def test_08_builder_with_logger_is_chainable():
    from polyglot_vault_file.logger import Logger
    sdk = (
        VaultFileSDK.create()
        .with_env_path("/x")
        .with_logger(Logger.create("t", "b"))
        .build()
    )
    assert sdk is not None


def test_09_vault_header_created_at_ms_precision():
    h = VaultHeader()
    assert re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+00:00$", h.created_at)


def test_10_diagnose_reports_real_vars_loaded():
    sdk = VaultFileSDK.create().build()
    sdk.set_env_path(str(FIXTURES / ".env.mixed"))
    sdk.load_config()
    r = sdk.diagnose_env_store()
    assert r.success is True
    assert r.data.vars_loaded > 0


def test_11_no_unused_deps_declared():
    import tomllib
    pyproject_path = Path(__file__).parent.parent / "pyproject.toml"
    pyproject = tomllib.loads(pyproject_path.read_text())
    deps = " ".join(pyproject["project"]["dependencies"])
    assert "python-dotenv" not in deps
    assert "pyyaml" not in deps


def test_12_no_ts_ignore_applicable():
    # N/A for Python — parity check is the TS-side test_12. This test is a marker.
    assert True
