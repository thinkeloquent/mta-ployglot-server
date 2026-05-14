"""Tests for auth primitives (Basic / Bearer / APIKey / Digest)."""

from __future__ import annotations

import base64

import httpx
import pytest

from fetch_http_client import (
    APIKeyAuth,
    BasicAuth,
    BearerAuth,
    DigestAuth,
    build_auth,
)


def _apply(auth: httpx.Auth, request: httpx.Request) -> httpx.Request:
    gen = auth.auth_flow(request)
    applied = next(gen)
    return applied


class TestBasicAuth:
    def test_sets_basic_header(self) -> None:
        auth = BasicAuth("alice", "secret")
        req = httpx.Request("GET", "https://example.com/")
        applied = _apply(auth, req)
        expected = "Basic " + base64.b64encode(b"alice:secret").decode("ascii")
        assert applied.headers["Authorization"] == expected


class TestBearerAuth:
    def test_sets_bearer_header(self) -> None:
        auth = BearerAuth("token-xyz")
        req = httpx.Request("GET", "https://example.com/")
        applied = _apply(auth, req)
        assert applied.headers["Authorization"] == "Bearer token-xyz"


class TestAPIKeyAuth:
    def test_default_header(self) -> None:
        auth = APIKeyAuth("k1")
        req = httpx.Request("GET", "https://example.com/")
        applied = _apply(auth, req)
        assert applied.headers["X-API-Key"] == "k1"

    def test_custom_header(self) -> None:
        auth = APIKeyAuth("k2", header_name="X-Figma-Token")
        req = httpx.Request("GET", "https://example.com/")
        applied = _apply(auth, req)
        assert applied.headers["X-Figma-Token"] == "k2"

    def test_statsig_header(self) -> None:
        auth = APIKeyAuth("console-secret", header_name="STATSIG-API-KEY")
        req = httpx.Request("GET", "https://example.com/")
        applied = _apply(auth, req)
        assert applied.headers["STATSIG-API-KEY"] == "console-secret"


class TestDigestAuth:
    def test_delegates_to_httpx(self) -> None:
        auth = DigestAuth("u", "p")
        assert auth._inner is not None

    def test_auth_flow_yields_request(self) -> None:
        auth = DigestAuth("alice", "pw")
        req = httpx.Request("GET", "https://example.com/secure")
        gen = auth.auth_flow(req)
        first = next(gen)
        # Digest sends the original request first (no Authorization yet),
        # then waits for a 401 challenge response.
        assert first is req


class TestBuildAuth:
    def test_none_returns_none(self) -> None:
        assert build_auth(None) is None

    def test_instance_pass_through(self) -> None:
        b = BasicAuth("a", "b")
        assert build_auth(b) is b

    def test_tuple_becomes_basic(self) -> None:
        a = build_auth(("alice", "secret"))
        assert isinstance(a, BasicAuth)
        assert a.username == "alice"

    def test_string_becomes_bearer(self) -> None:
        a = build_auth("token")
        assert isinstance(a, BearerAuth)
        assert a.token == "token"

    def test_invalid_raises(self) -> None:
        with pytest.raises(TypeError):
            build_auth(42)

    def test_wraps_raw_httpx_auth(self) -> None:
        # A raw httpx.Auth (not one of our subclasses) is wrapped so the
        # client always sees our `Auth` base class.
        raw = httpx.BasicAuth("alice", "secret")
        wrapped = build_auth(raw)
        assert wrapped is not None
        # The wrapper forwards auth_flow to the underlying object.
        req = httpx.Request("GET", "https://example.com/")
        applied = _apply(wrapped, req)
        assert applied.headers["Authorization"].startswith("Basic ")

    def test_tuple_wrong_arity_raises(self) -> None:
        with pytest.raises(TypeError):
            build_auth(("a",))
        with pytest.raises(TypeError):
            build_auth(("a", "b", "c"))

    def test_tuple_non_string_coerced(self) -> None:
        a = build_auth((123, 456))
        assert isinstance(a, BasicAuth)
        assert a.username == "123"
        assert a.password == "456"
