"""Proxy + env helpers — mirror the shape used by the sibling
``polyglot-fetch-http-client`` integration examples so FigmaClient and
downstream callers share one idiom.

Convention each entry point follows:

- ``FIGMA_HOST``   — optional override (default ``https://api.figma.com``)
- ``FIGMA_USER``   — placeholder (Figma is token-only)
- ``FIGMA_PASS``   — required token
- ``HTTPS_PROXY`` / ``HTTP_PROXY`` / ``NO_PROXY`` — optional forward proxy

Proxy contract:

- ``build_proxy({})`` — auto-detect from env
- ``build_proxy({"host": ...})`` — explicit host
- ``build_proxy({"host": h, "user": u, "pass": p})`` — full override

When no proxy is discoverable, returns ``None`` and callers MUST omit
the ``proxy=`` kwarg on the underlying fetch client.
"""

from __future__ import annotations

import os
from typing import TypedDict

from fetch_http_client import Proxy, ProxyAuth


class ProxyOptionsBag(TypedDict, total=False):
    host: str
    user: str
    pass_: str  # underscored alias — `pass` is a Python keyword


def require_env(name: str) -> str:
    v = os.environ.get(name)
    if v is None or v == "":
        raise RuntimeError(
            f"Missing env {name}. Set it in your shell, a .env file, "
            f"or your secret manager and rerun."
        )
    return v


def optional_env(name: str, fallback: str) -> str:
    v = os.environ.get(name)
    return v if v is not None and v != "" else fallback


def build_proxy(options: dict | None = None) -> Proxy | None:
    """Build a :class:`Proxy` from an options dict + env fallbacks.

    The dict accepts ``host`` / ``user`` / ``pass`` keys. ``{}`` means
    "auto-detect from env".
    """
    options = options or {}
    host = (
        options.get("host")
        or os.environ.get("HTTPS_PROXY")
        or os.environ.get("HTTP_PROXY")
    )
    if not host:
        return None

    user = options.get("user") or os.environ.get("HTTP_PROXY_USER")
    password = (
        options.get("pass")
        or options.get("password")
        or os.environ.get("HTTP_PROXY_PASS")
    )

    if user and password:
        return Proxy(url=host, auth=ProxyAuth(username=user, password=password))
    return Proxy(url=host)
