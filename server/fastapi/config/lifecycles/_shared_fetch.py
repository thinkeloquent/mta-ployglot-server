"""Shared env + proxy helpers for FastAPI integration routes.

Inlined from mta-ployglot-pkg-fetch-client/packages/py/examples/_shared.py
because the package's examples directory is not part of its published
surface.
"""

from __future__ import annotations

import os
from base64 import b64encode

from fetch_http_client import Proxy, ProxyAuth


def require_env(name: str) -> str:
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
    token = b64encode(f"{user}:{password}".encode()).decode("ascii")
    return f"Basic {token}"
