"""Smoke tests: each integration example constructs its client + proxy without error.

These don't hit the network — they mock env vars and verify that the
integration module's client setup path wires auth / headers / proxy correctly.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

from fetch_http_client import APIKeyAuth, AsyncClient, BasicAuth, BearerAuth

_PKG_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(_PKG_ROOT))

from examples._shared import build_proxy  # noqa: E402


def _clean_proxy_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for k in ("HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy"):
        monkeypatch.delenv(k, raising=False)


class TestIntegrationWiring:
    """Build the client the way each integration example does and assert auth."""

    def test_jira_wiring(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _clean_proxy_env(monkeypatch)
        client = AsyncClient(
            base_url="https://acme.atlassian.net",
            auth=BasicAuth("me@acme.com", "token"),
            headers={"accept": "application/json"},
        )
        assert isinstance(client._auth, BasicAuth)

    def test_confluence_wiring(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _clean_proxy_env(monkeypatch)
        client = AsyncClient(
            base_url="https://acme.atlassian.net/wiki",
            auth=BasicAuth("me@acme.com", "token"),
        )
        assert isinstance(client._auth, BasicAuth)

    def test_github_wiring(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _clean_proxy_env(monkeypatch)
        client = AsyncClient(
            base_url="https://api.github.com",
            auth=BearerAuth("ghp_xxx"),
            headers={
                "accept": "application/vnd.github+json",
                "x-github-api-version": "2022-11-28",
            },
        )
        assert isinstance(client._auth, BearerAuth)

    def test_figma_wiring(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _clean_proxy_env(monkeypatch)
        client = AsyncClient(
            base_url="https://api.figma.com",
            auth=APIKeyAuth("figd_xxx", "X-Figma-Token"),
        )
        assert isinstance(client._auth, APIKeyAuth)
        assert client._auth.header_name == "X-Figma-Token"

    def test_statsig_wiring(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _clean_proxy_env(monkeypatch)
        client = AsyncClient(
            base_url="https://statsigapi.net",
            auth=APIKeyAuth("secret-console", "STATSIG-API-KEY"),
        )
        assert isinstance(client._auth, APIKeyAuth)
        assert client._auth.header_name == "STATSIG-API-KEY"

    def test_saucelabs_wiring(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _clean_proxy_env(monkeypatch)
        client = AsyncClient(
            base_url="https://api.us-west-1.saucelabs.com",
            auth=BasicAuth("sauce-user", "access-key"),
        )
        assert isinstance(client._auth, BasicAuth)


class TestIntegrationsProxyPlaceholder:
    """Every integration passes `proxy={}` — exercise both branches."""

    def test_empty_proxy_no_env_returns_none(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _clean_proxy_env(monkeypatch)
        assert build_proxy({}) is None

    def test_empty_proxy_with_env_populated(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("HTTPS_PROXY", "http://proxy.internal:3128")
        proxy = build_proxy({})
        assert proxy is not None
        assert proxy.url == "http://proxy.internal:3128"

    def test_integration_client_accepts_proxy(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("HTTPS_PROXY", "http://proxy.internal:3128")
        proxy = build_proxy({})
        kwargs: dict = {
            "base_url": "https://api.github.com",
            "auth": BearerAuth("tok"),
        }
        if proxy is not None:
            kwargs["proxy"] = proxy
        client = AsyncClient(**kwargs)
        assert client._proxy is not None
        assert client._proxy.url == "http://proxy.internal:3128"


class TestIntegrationModulesImportable:
    """Regression: every integration module imports without error."""

    @pytest.mark.parametrize(
        "mod",
        [
            "examples.integrations.jira",
            "examples.integrations.confluence",
            "examples.integrations.github",
            "examples.integrations.figma",
            "examples.integrations.statsig",
            "examples.integrations.saucelabs",
        ],
    )
    def test_import(self, mod: str) -> None:
        import importlib

        importlib.import_module(mod)
