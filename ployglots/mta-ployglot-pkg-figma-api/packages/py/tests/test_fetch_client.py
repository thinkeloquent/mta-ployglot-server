from figma_api import create_figma_fetch_client, resolve_figma_config
from figma_api._fetch_client import create_default_fetch_client


def test_create_default_fetch_client_returns_async_client(monkeypatch):
    monkeypatch.delenv("FIGMA_PASS", raising=False)
    cfg = resolve_figma_config(token="t", proxy={})
    fc = create_default_fetch_client(cfg)
    assert hasattr(fc, "get")
    assert hasattr(fc, "post")
    assert hasattr(fc, "aclose")


def test_create_figma_fetch_client_is_equivalent(monkeypatch):
    monkeypatch.delenv("FIGMA_PASS", raising=False)
    fc = create_figma_fetch_client(token="t")
    assert hasattr(fc, "get")
    assert hasattr(fc, "aclose")


def test_fetch_client_from_polyglot_passes_through(monkeypatch):
    from fetch_http_client import APIKeyAuth, AsyncClient

    from figma_api import fetch_client_from_polyglot

    outer = AsyncClient(
        base_url="https://api.figma.com",
        auth=APIKeyAuth("t", "X-Figma-Token"),
    )
    wrapped = fetch_client_from_polyglot(outer)
    # BYO adapter returns the same instance.
    assert wrapped is outer


def test_create_default_fetch_client_with_https_proxy(monkeypatch):
    monkeypatch.delenv("FIGMA_PASS", raising=False)
    monkeypatch.setenv("HTTPS_PROXY", "http://proxy.corp:3128")
    cfg = resolve_figma_config(token="t", proxy={})
    fc = create_default_fetch_client(cfg)
    assert hasattr(fc, "get")


def test_create_default_fetch_client_with_retry_disabled(monkeypatch):
    monkeypatch.delenv("FIGMA_PASS", raising=False)
    cfg = resolve_figma_config(token="t", retry=False)
    fc = create_default_fetch_client(cfg)
    assert hasattr(fc, "get")
