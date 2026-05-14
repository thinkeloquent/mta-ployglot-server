import json
import subprocess
import sys
from pathlib import Path

import pytest

from app_yaml_fetch_config import (
    ConfigError,
    get_config,
    list_endpoints,
    load_config,
    load_config_from_file,
)


def test_load_config_stores_and_returns_identity():
    obj = {"endpoints": {"a": {"baseUrl": "x"}}}
    ret = load_config(obj)
    assert ret is obj
    assert get_config() is obj


def test_load_config_empty_resets():
    load_config({})
    assert get_config() == {}
    assert list_endpoints() == []


def test_list_endpoints_returns_keys():
    load_config({"endpoints": {"a": {}, "b": {}, "c": {}}})
    assert sorted(list_endpoints()) == ["a", "b", "c"]


def test_load_config_from_file_reads_yaml(tmp_path: Path):
    file = tmp_path / "endpoints.yaml"
    file.write_text(
        "endpoints:\n  llm001:\n    baseUrl: https://x\n    method: POST\n"
        "intent_mapping:\n  default_intent: llm001\n",
        encoding="utf-8",
    )
    cfg = load_config_from_file(str(file))
    assert cfg["endpoints"]["llm001"]["baseUrl"] == "https://x"
    assert cfg["intent_mapping"]["default_intent"] == "llm001"


def test_load_config_from_file_missing_warns_and_returns_defaults(caplog):
    cfg = load_config_from_file("/nonexistent/path/that/does/not/exist.yaml")
    assert cfg == {"endpoints": {}, "intent_mapping": {}}


def test_load_config_from_file_invalid_yaml_raises(tmp_path: Path):
    bad = tmp_path / "bad.yaml"
    bad.write_text("endpoints:\n  llm001: { baseUrl: : :\n", encoding="utf-8")
    with pytest.raises(ConfigError):
        load_config_from_file(str(bad))


def test_get_config_before_load_throws():
    # Subprocess: module-level _config is process-wide; earlier tests populate it.
    code = (
        "from app_yaml_fetch_config import get_config, ConfigError\n"
        "try:\n"
        "    get_config()\n"
        "    print('NO_THROW')\n"
        "except ConfigError:\n"
        "    print('ConfigError')\n"
    )
    res = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True)
    assert res.stdout.strip() == "ConfigError"
