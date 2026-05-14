"""Tests for the examples `_shared.py` helpers (env + proxy)."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

from fetch_http_client import Proxy

_PKG_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(_PKG_ROOT))

from examples._shared import (  # noqa: E402
    basic_auth_header,
    build_proxy,
    optional_env,
    require_env,
)


class TestRequireEnv:
    def test_returns_value(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("FOO", "bar")
        assert require_env("FOO") == "bar"

    def test_raises_on_missing(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("FOO", raising=False)
        with pytest.raises(RuntimeError, match="Missing env FOO"):
            require_env("FOO")

    def test_raises_on_empty(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("FOO", "")
        with pytest.raises(RuntimeError):
            require_env("FOO")


class TestOptionalEnv:
    def test_returns_value(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("FOO", "bar")
        assert optional_env("FOO", "fallback") == "bar"

    def test_fallback_on_missing(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("FOO", raising=False)
        assert optional_env("FOO", "fallback") == "fallback"


class TestBuildProxy:
    def _clean(self, monkeypatch: pytest.MonkeyPatch) -> None:
        for k in (
            "HTTPS_PROXY",
            "https_proxy",
            "HTTP_PROXY",
            "http_proxy",
            "HTTP_PROXY_USER",
            "HTTP_PROXY_PASS",
        ):
            monkeypatch.delenv(k, raising=False)

    def test_empty_no_env_returns_none(self, monkeypatch: pytest.MonkeyPatch) -> None:
        self._clean(monkeypatch)
        assert build_proxy({}) is None

    def test_empty_with_env_autodetects(self, monkeypatch: pytest.MonkeyPatch) -> None:
        self._clean(monkeypatch)
        monkeypatch.setenv("HTTPS_PROXY", "http://p:3128")
        proxy = build_proxy({})
        assert isinstance(proxy, Proxy)
        assert proxy.url == "http://p:3128"

    def test_explicit_host_overrides_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("HTTPS_PROXY", "http://env:3128")
        proxy = build_proxy({"host": "http://explicit:3128"})
        assert proxy is not None
        assert proxy.url == "http://explicit:3128"

    def test_with_auth(self, monkeypatch: pytest.MonkeyPatch) -> None:
        self._clean(monkeypatch)
        proxy = build_proxy({"host": "http://p:3128", "user": "u", "pass": "x"})
        assert proxy is not None
        assert proxy.auth is not None
        assert proxy.auth.username == "u"
        assert proxy.auth.password == "x"

    def test_none_args(self, monkeypatch: pytest.MonkeyPatch) -> None:
        self._clean(monkeypatch)
        assert build_proxy() is None
        assert build_proxy(None) is None


class TestBasicAuthHeader:
    def test_encodes(self) -> None:
        header = basic_auth_header("alice", "secret")
        assert header.startswith("Basic ")
        assert header == "Basic YWxpY2U6c2VjcmV0"
