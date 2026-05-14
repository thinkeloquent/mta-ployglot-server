"""Shared env + proxy helpers used by every integration example.

Convention each example follows:
    <SERVICE>_HOST   — API host (override the provider default)
    <SERVICE>_USER   — username / email / account id (when applicable)
    <SERVICE>_PASS   — password / API token / access key
    HTTPS_PROXY / HTTP_PROXY / NO_PROXY — optional forward proxy

Proxy contract:
    - Every example calls `build_proxy({})`. The empty dict means
      "auto-detect from HTTPS_PROXY / HTTP_PROXY env vars".
    - Pass `{"host": ..., "user": ..., "pass": ...}` to override explicitly.
    - When no proxy is discoverable, `build_proxy(...)` returns `None` and
      callers omit the `proxy=` kwarg on the client.
"""

from __future__ import annotations

import os
from base64 import b64encode

from fetch_http_client import Proxy, ProxyAuth


def require_env(name: str) -> str:
    """Return env var `name`, raising if unset or empty."""
    v = os.environ.get(name)
    if v is None or v == "":
        raise RuntimeError(
            f"Missing env {name}. Set it in your shell, a .env file, or your "
            f"secret manager and rerun."
        )
    return v


def optional_env(name: str, fallback: str) -> str:
    v = os.environ.get(name)
    return v if v is not None and v != "" else fallback


def build_proxy(options: dict | None = None) -> Proxy | None:
    """Build a `Proxy` from an options dict with env fallbacks.

    Call patterns:
        - `build_proxy({})`                             → auto-detect from env
        - `build_proxy({"host": "http://p:3128"})`      → explicit host
        - `build_proxy({"host": h, "user": u, "pass": p})` → full override

    Returns `None` when no proxy host is discoverable.
    """
    options = options or {}
    host = options.get("host") or os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY")
    if not host:
        return None

    user = options.get("user") or os.environ.get("HTTP_PROXY_USER")
    password = options.get("pass") or options.get("password") or os.environ.get("HTTP_PROXY_PASS")

    if user and password:
        return Proxy(url=host, auth=ProxyAuth(username=user, password=password))
    return Proxy(url=host)


def basic_auth_header(user: str, password: str) -> str:
    """Return an `Authorization: Basic ...` header value."""
    token = b64encode(f"{user}:{password}".encode()).decode("ascii")
    return f"Basic {token}"
