"""Tests for Timeout / Limits / Proxy and env helpers."""

from __future__ import annotations

import pytest

from fetch_http_client import (
    DEFAULT_LIMITS,
    DEFAULT_LLM_TIMEOUT,
    DEFAULT_TIMEOUT,
    Limits,
    Proxy,
    ProxyAuth,
    Timeout,
    get_proxy_from_env,
    should_bypass_proxy,
)


class TestTimeout:
    def test_defaults(self) -> None:
        t = Timeout()
        assert t.connect == 5.0
        assert t.read == 30.0

    def test_from_number(self) -> None:
        t = Timeout.from_any(2.5)
        assert t.connect == t.read == t.write == t.pool == 2.5

    def test_from_dict_partial(self) -> None:
        t = Timeout.from_any({"connect": 1.0, "read": 10.0})
        assert t.connect == 1.0
        assert t.read == 10.0
        assert t.write == 30.0  # fallback default

    def test_from_none(self) -> None:
        assert Timeout.from_any(None) == Timeout()

    def test_invalid_raises(self) -> None:
        with pytest.raises(TypeError):
            Timeout.from_any(object())

    def test_llm_defaults(self) -> None:
        assert DEFAULT_LLM_TIMEOUT.read == 120.0

    def test_to_httpx(self) -> None:
        import httpx

        assert isinstance(DEFAULT_TIMEOUT.to_httpx(), httpx.Timeout)


class TestLimits:
    def test_defaults(self) -> None:
        assert DEFAULT_LIMITS.max_connections == 100

    def test_to_httpx(self) -> None:
        import httpx

        assert isinstance(Limits().to_httpx(), httpx.Limits)


class TestProxy:
    def test_resolved_url_noop(self) -> None:
        p = Proxy(url="http://proxy:3128")
        assert p.resolved_url() == "http://proxy:3128"

    def test_resolved_url_with_auth(self) -> None:
        p = Proxy(url="http://proxy:3128", auth=ProxyAuth(username="u", password="p"))
        assert p.resolved_url() == "http://u:p@proxy:3128"

    def test_resolved_url_none(self) -> None:
        p = Proxy()
        assert p.resolved_url() is None


class TestEnvHelpers:
    def test_get_proxy_from_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        for k in ("HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy"):
            monkeypatch.delenv(k, raising=False)
        assert get_proxy_from_env() is None

        monkeypatch.setenv("HTTPS_PROXY", "http://p:3128")
        assert get_proxy_from_env() == "http://p:3128"

    def test_should_bypass_proxy_exact(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("NO_PROXY", "internal.example.com,corp.local")
        assert should_bypass_proxy("internal.example.com")
        assert not should_bypass_proxy("external.example.com")

    def test_should_bypass_proxy_suffix(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("NO_PROXY", ".example.com")
        assert should_bypass_proxy("internal.example.com")
        assert should_bypass_proxy("example.com")

    def test_should_bypass_proxy_wildcard(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("NO_PROXY", "*")
        assert should_bypass_proxy("anything.com")

    def test_should_bypass_proxy_unset(self, monkeypatch: pytest.MonkeyPatch) -> None:
        for k in ("NO_PROXY", "no_proxy"):
            monkeypatch.delenv(k, raising=False)
        assert not should_bypass_proxy("anything.com")

    def test_should_bypass_proxy_lowercase_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("NO_PROXY", raising=False)
        monkeypatch.setenv("no_proxy", "internal.example.com")
        assert should_bypass_proxy("internal.example.com")

    def test_should_bypass_proxy_ignores_empty_rule(self, monkeypatch: pytest.MonkeyPatch) -> None:
        # Leading/trailing commas produce empty rules which must be skipped.
        monkeypatch.setenv("NO_PROXY", ",internal.example.com, ,")
        assert should_bypass_proxy("internal.example.com")
        assert not should_bypass_proxy("other.example.com")


class TestTimeoutPassthrough:
    def test_from_any_accepts_instance(self) -> None:
        # Timeout.from_any(Timeout) returns the instance unchanged.
        original = Timeout(connect=7.0, read=11.0, write=3.0, pool=2.0)
        assert Timeout.from_any(original) is original
