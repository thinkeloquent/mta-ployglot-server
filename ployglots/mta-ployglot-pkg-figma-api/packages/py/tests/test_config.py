import pytest

from figma_api import DEFAULT_FIGMA_HOST, FigmaConfigError, resolve_figma_config


def _clean_env(monkeypatch):
    for k in ("FIGMA_HOST", "FIGMA_USER", "FIGMA_PASS"):
        monkeypatch.delenv(k, raising=False)


def test_explicit_token_and_host_win_over_env(monkeypatch):
    _clean_env(monkeypatch)
    monkeypatch.setenv("FIGMA_HOST", "https://from-env.example")
    monkeypatch.setenv("FIGMA_PASS", "env-token")
    cfg = resolve_figma_config(token="explicit", host="https://explicit.example")
    assert cfg.token == "explicit"
    assert cfg.host == "https://explicit.example"


def test_falls_back_to_env_pass(monkeypatch):
    _clean_env(monkeypatch)
    monkeypatch.setenv("FIGMA_PASS", "env-token")
    cfg = resolve_figma_config()
    assert cfg.token == "env-token"
    assert cfg.host == DEFAULT_FIGMA_HOST


def test_figma_user_placeholder(monkeypatch):
    _clean_env(monkeypatch)
    monkeypatch.setenv("FIGMA_PASS", "env-token")
    monkeypatch.setenv("FIGMA_USER", "me@example.com")
    cfg = resolve_figma_config()
    assert cfg.user == "me@example.com"


def test_missing_token_raises(monkeypatch):
    _clean_env(monkeypatch)
    with pytest.raises(FigmaConfigError):
        resolve_figma_config()


def test_non_http_host_rejected(monkeypatch):
    _clean_env(monkeypatch)
    with pytest.raises(FigmaConfigError):
        resolve_figma_config(token="t", host="ftp://bad")


def test_proxy_empty_is_retained(monkeypatch):
    _clean_env(monkeypatch)
    cfg = resolve_figma_config(token="t", proxy={})
    assert cfg.proxy == {}


def test_proxy_bag_propagated(monkeypatch):
    _clean_env(monkeypatch)
    cfg = resolve_figma_config(token="t", proxy={"host": "http://p:3128"})
    assert cfg.proxy == {"host": "http://p:3128"}
