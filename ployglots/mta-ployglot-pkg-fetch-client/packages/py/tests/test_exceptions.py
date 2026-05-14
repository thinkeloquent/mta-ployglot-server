"""Tests for the exception hierarchy + map_exception."""

from __future__ import annotations

import httpx

from fetch_http_client import (
    ConnectError,
    ConnectTimeout,
    HTTPError,
    HTTPStatusError,
    NetworkError,
    PoolTimeout,
    ProxyError,
    ReadTimeout,
    RequestError,
    TimeoutException,
    TransportError,
    map_exception,
)


class TestHierarchy:
    def test_connect_error_is_network(self) -> None:
        assert issubclass(ConnectError, NetworkError)
        assert issubclass(NetworkError, TransportError)
        assert issubclass(TransportError, RequestError)
        assert issubclass(RequestError, HTTPError)

    def test_connect_timeout_is_timeout(self) -> None:
        assert issubclass(ConnectTimeout, TimeoutException)
        assert issubclass(ReadTimeout, TimeoutException)
        assert issubclass(PoolTimeout, TimeoutException)

    def test_status_error_has_response(self) -> None:
        err = HTTPStatusError("boom")
        assert err.response is None
        assert isinstance(err, HTTPError)


class TestMapException:
    def test_maps_connect_error(self) -> None:
        mapped = map_exception(httpx.ConnectError("boom"))
        assert isinstance(mapped, ConnectError)

    def test_maps_read_timeout(self) -> None:
        mapped = map_exception(httpx.ReadTimeout("slow"))
        assert isinstance(mapped, ReadTimeout)

    def test_maps_proxy_error(self) -> None:
        mapped = map_exception(httpx.ProxyError("bad proxy"))
        assert isinstance(mapped, ProxyError)

    def test_unknown_becomes_transport(self) -> None:
        class Custom(Exception):
            pass

        mapped = map_exception(Custom("???"))
        assert isinstance(mapped, TransportError)

    def test_preserves_cause(self) -> None:
        src = httpx.ConnectError("root")
        mapped = map_exception(src)
        assert mapped.__cause__ is src
