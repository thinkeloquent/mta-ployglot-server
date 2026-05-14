"""Exception hierarchy for fetch_http_client.

Mirrors the 30-class httpx-style hierarchy plus cache and circuit-breaker
specific exceptions. Every network/HTTP failure surfaces as an HTTPError
subclass so callers can write `except HTTPError:` and catch everything.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import httpx

if TYPE_CHECKING:
    from ._models import Request, Response


class HTTPError(Exception):
    """Base class for every fetch_http_client exception."""

    def __init__(self, message: str, *, request: Request | None = None) -> None:
        super().__init__(message)
        self.request = request


class RequestError(HTTPError):
    """A transport-level or request-construction failure (no response produced)."""


class TransportError(RequestError):
    """Base class for low-level transport errors."""


class NetworkError(TransportError):
    """Generic network failure (DNS, socket, TCP)."""


class ConnectError(NetworkError):
    """Failed to establish a TCP connection to the host."""


class ReadError(NetworkError):
    """Connection closed or read failed mid-response."""


class WriteError(NetworkError):
    """Connection closed or write failed mid-request."""


class CloseError(NetworkError):
    """Failed to close the underlying connection cleanly."""


class ProtocolError(TransportError):
    """The server violated the HTTP protocol."""


class LocalProtocolError(ProtocolError):
    """We violated the HTTP protocol locally."""


class RemoteProtocolError(ProtocolError):
    """The server violated the HTTP protocol."""


class ProxyError(TransportError):
    """Proxy could not be reached or returned a bad response."""


class UnsupportedProtocol(TransportError):
    """Scheme is unsupported (e.g. ftp:// handed to an HTTP client)."""


class TimeoutException(TransportError):
    """Base for every timeout variant."""


class ConnectTimeout(TimeoutException):
    """Timed out while establishing the connection."""


class ReadTimeout(TimeoutException):
    """Timed out while reading the response."""


class WriteTimeout(TimeoutException):
    """Timed out while writing the request."""


class PoolTimeout(TimeoutException):
    """Timed out while waiting for a pool slot."""


class DecodingError(RequestError):
    """Response body could not be decoded (charset/encoding failure)."""


class TooManyRedirects(RequestError):
    """Redirect chain exceeded the configured maximum."""


class HTTPStatusError(HTTPError):
    """Raised by `response.raise_for_status()` on 4xx/5xx responses."""

    def __init__(
        self,
        message: str,
        *,
        request: Request | None = None,
        response: Response | None = None,
    ) -> None:
        super().__init__(message, request=request)
        self.response = response


class InvalidURL(RequestError):
    """A URL could not be parsed or is malformed."""


class CookieConflict(RequestError):
    """Multiple cookies with the same name but different domains/paths."""


class StreamError(RuntimeError):
    """Base for stream-consumption errors."""


class StreamConsumed(StreamError):
    """The stream body has already been consumed."""


class StreamClosed(StreamError):
    """The stream has been closed."""


class ResponseNotRead(StreamError):
    """Response body was not read before access (call `.read()` or `.aread()`)."""


class RequestNotRead(StreamError):
    """Request body was not read before access."""


# =============================================================================
# Authentication
# =============================================================================


class AuthError(HTTPError):
    """Authentication failed (401 / bad credentials / token rejected)."""


# =============================================================================
# Cache
# =============================================================================


class CacheError(HTTPError):
    """Base cache subsystem exception."""


class CacheStorageError(CacheError):
    """Cache storage backend failed (read/write)."""


class CacheKeyError(CacheError):
    """Cache key could not be built from the request."""


# =============================================================================
# Circuit breaker
# =============================================================================


class CircuitOpenError(HTTPError):
    """The circuit breaker is OPEN; requests are short-circuited."""


# =============================================================================
# Mapping
# =============================================================================

_HTTPX_MAP: dict[type[Exception], type[HTTPError]] = {
    httpx.ConnectError: ConnectError,
    httpx.ReadError: ReadError,
    httpx.WriteError: WriteError,
    httpx.CloseError: CloseError,
    httpx.ConnectTimeout: ConnectTimeout,
    httpx.ReadTimeout: ReadTimeout,
    httpx.WriteTimeout: WriteTimeout,
    httpx.PoolTimeout: PoolTimeout,
    httpx.TimeoutException: TimeoutException,
    httpx.ProxyError: ProxyError,
    httpx.UnsupportedProtocol: UnsupportedProtocol,
    httpx.LocalProtocolError: LocalProtocolError,
    httpx.RemoteProtocolError: RemoteProtocolError,
    httpx.ProtocolError: ProtocolError,
    httpx.DecodingError: DecodingError,
    httpx.TooManyRedirects: TooManyRedirects,
    httpx.InvalidURL: InvalidURL,
    httpx.CookieConflict: CookieConflict,
    httpx.StreamConsumed: StreamConsumed,
    httpx.StreamClosed: StreamClosed,
    httpx.ResponseNotRead: ResponseNotRead,
    httpx.RequestNotRead: RequestNotRead,
    httpx.NetworkError: NetworkError,
    httpx.TransportError: TransportError,
    httpx.RequestError: RequestError,
    httpx.HTTPError: HTTPError,
}


def map_exception(exc: Exception, *, request: Request | None = None) -> HTTPError:
    """Translate an underlying `httpx` error into our typed hierarchy.

    Unknown/unmapped exceptions become a `TransportError` so callers can still
    use a broad `except TransportError` to catch infrastructure failures.
    """
    for httpx_cls, our_cls in _HTTPX_MAP.items():
        if isinstance(exc, httpx_cls):
            mapped = our_cls(str(exc), request=request)
            mapped.__cause__ = exc
            return mapped
    wrapped = TransportError(str(exc), request=request)
    wrapped.__cause__ = exc
    return wrapped


__all__ = [
    "AuthError",
    "CacheError",
    "CacheKeyError",
    "CacheStorageError",
    "CircuitOpenError",
    "CloseError",
    "ConnectError",
    "ConnectTimeout",
    "CookieConflict",
    "DecodingError",
    "HTTPError",
    "HTTPStatusError",
    "InvalidURL",
    "LocalProtocolError",
    "NetworkError",
    "PoolTimeout",
    "ProtocolError",
    "ProxyError",
    "ReadError",
    "ReadTimeout",
    "RemoteProtocolError",
    "RequestError",
    "RequestNotRead",
    "ResponseNotRead",
    "StreamClosed",
    "StreamConsumed",
    "StreamError",
    "TimeoutException",
    "TooManyRedirects",
    "TransportError",
    "UnsupportedProtocol",
    "WriteError",
    "WriteTimeout",
    "map_exception",
]
