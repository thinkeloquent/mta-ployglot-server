"""Authentication primitives: Basic, Bearer, APIKey, Digest.

All classes implement `httpx.Auth` so they plug straight into the
underlying transport. `build_auth` normalises user-supplied values
(tuple of (user, pass), str token, or Auth instance).
"""

from __future__ import annotations

import base64
from collections.abc import Generator
from typing import Any

import httpx


class Auth(httpx.Auth):
    """Base class — subclasses implement `auth_flow`."""


class BasicAuth(Auth):
    """HTTP Basic authentication (Authorization: Basic base64(user:pass))."""

    requires_request_body = False

    def __init__(self, username: str, password: str) -> None:
        self.username = username
        self.password = password

    def _header(self) -> str:
        token = base64.b64encode(f"{self.username}:{self.password}".encode()).decode("ascii")
        return f"Basic {token}"

    def auth_flow(self, request: httpx.Request) -> Generator[httpx.Request, httpx.Response, None]:
        request.headers["Authorization"] = self._header()
        yield request


class BearerAuth(Auth):
    """OAuth2-style bearer token (Authorization: Bearer <token>)."""

    requires_request_body = False

    def __init__(self, token: str) -> None:
        self.token = token

    def auth_flow(self, request: httpx.Request) -> Generator[httpx.Request, httpx.Response, None]:
        request.headers["Authorization"] = f"Bearer {self.token}"
        yield request


class APIKeyAuth(Auth):
    """Generic API-key header (e.g. X-Figma-Token, STATSIG-API-KEY)."""

    requires_request_body = False

    def __init__(self, token: str, header_name: str = "X-API-Key") -> None:
        self.token = token
        self.header_name = header_name

    def auth_flow(self, request: httpx.Request) -> Generator[httpx.Request, httpx.Response, None]:
        request.headers[self.header_name] = self.token
        yield request


class DigestAuth(Auth):
    """RFC 7616 Digest auth. Delegates to httpx's built-in implementation."""

    requires_request_body = False

    def __init__(self, username: str, password: str) -> None:
        self.username = username
        self.password = password
        self._inner = httpx.DigestAuth(username, password)

    def auth_flow(self, request: httpx.Request) -> Generator[httpx.Request, httpx.Response, None]:
        yield from self._inner.auth_flow(request)


def build_auth(value: Any) -> Auth | None:
    """Normalise an auth argument into an Auth instance (or None).

    Accepts:
      - None        → None (no auth)
      - Auth        → returned as-is
      - (u, p)      → BasicAuth
      - str token   → BearerAuth
    """
    if value is None:
        return None
    if isinstance(value, Auth):
        return value
    if isinstance(value, httpx.Auth):
        # Wrap any raw httpx.Auth so we keep a single base class.
        wrapper = Auth.__new__(Auth)
        wrapper.auth_flow = value.auth_flow  # type: ignore[method-assign]
        return wrapper
    if isinstance(value, tuple) and len(value) == 2:
        return BasicAuth(str(value[0]), str(value[1]))
    if isinstance(value, str):
        return BearerAuth(value)
    raise TypeError(f"Unsupported auth value: {type(value).__name__}")


__all__ = [
    "APIKeyAuth",
    "Auth",
    "BasicAuth",
    "BearerAuth",
    "DigestAuth",
    "build_auth",
]
