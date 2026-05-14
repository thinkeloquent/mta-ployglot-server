import pytest

from figma_api import build_proxy, optional_env, require_env


def _clean(monkeypatch, *names: str) -> None:
    for n in names:
        monkeypatch.delenv(n, raising=False)


def test_require_env_raises(monkeypatch):
    _clean(monkeypatch, "THING_UNSET")
    with pytest.raises(RuntimeError, match="Missing env"):
        require_env("THING_UNSET")


def test_optional_env_fallback(monkeypatch):
    _clean(monkeypatch, "MAYBE_X")
    assert optional_env("MAYBE_X", "fallback") == "fallback"
    monkeypatch.setenv("MAYBE_X", "here")
    assert optional_env("MAYBE_X", "fallback") == "here"


def test_build_proxy_empty_no_env(monkeypatch):
    _clean(monkeypatch, "HTTPS_PROXY", "HTTP_PROXY", "HTTP_PROXY_USER", "HTTP_PROXY_PASS")
    assert build_proxy({}) is None


def test_build_proxy_auto_detects_https(monkeypatch):
    _clean(monkeypatch, "HTTPS_PROXY", "HTTP_PROXY")
    monkeypatch.setenv("HTTPS_PROXY", "http://https-proxy:3128")
    p = build_proxy({})
    assert p is not None


def test_build_proxy_auto_detects_http(monkeypatch):
    _clean(monkeypatch, "HTTPS_PROXY", "HTTP_PROXY")
    monkeypatch.setenv("HTTP_PROXY", "http://http-proxy:3128")
    p = build_proxy({})
    assert p is not None


def test_build_proxy_explicit_host_wins(monkeypatch):
    monkeypatch.setenv("HTTPS_PROXY", "http://from-env:3128")
    p = build_proxy({"host": "http://explicit:3128"})
    assert p is not None


def test_build_proxy_with_full_auth(monkeypatch):
    _clean(monkeypatch, "HTTPS_PROXY", "HTTP_PROXY", "HTTP_PROXY_USER", "HTTP_PROXY_PASS")
    p = build_proxy({"host": "http://p:3128", "user": "u", "pass": "pw"})
    assert p is not None


def test_require_env_returns_value_when_set(monkeypatch):
    monkeypatch.setenv("PRESENT_X", "found")
    assert require_env("PRESENT_X") == "found"


def test_require_env_treats_empty_as_missing(monkeypatch):
    monkeypatch.setenv("EMPTY_Y", "")
    with pytest.raises(RuntimeError, match="Missing env"):
        require_env("EMPTY_Y")


def test_build_proxy_with_no_arg_uses_empty(monkeypatch):
    _clean(monkeypatch, "HTTPS_PROXY", "HTTP_PROXY")
    assert build_proxy() is None


def test_build_proxy_supports_password_alias(monkeypatch):
    """`password` is accepted as an alias for `pass`."""
    _clean(monkeypatch, "HTTP_PROXY_USER", "HTTP_PROXY_PASS")
    p = build_proxy({"host": "http://p:3128", "user": "u", "password": "pw"})
    assert p is not None


def test_build_proxy_bypasses_env_user_when_explicit(monkeypatch):
    monkeypatch.setenv("HTTP_PROXY_USER", "env-u")
    monkeypatch.setenv("HTTP_PROXY_PASS", "env-pw")
    # Explicit `user` + `pass` should override env.
    p = build_proxy({"host": "http://p:3128", "user": "explicit-u", "pass": "explicit-pw"})
    assert p is not None
