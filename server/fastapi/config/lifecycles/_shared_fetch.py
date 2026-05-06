"""Shared env + proxy helpers + cfg-slice composition primitives.

The env/proxy halves are inlined from
mta-ployglot-pkg-fetch-client/packages/py/examples/_shared.py.

The `resolve_*` / `with_proxy_kwargs` helpers below are the reusable
building blocks each per-provider factory in `_fetch_factories.py` calls
to assemble an AsyncClient from the post-pipeline `cfg.providers.<name>`
slice. They are intentionally named, single-purpose helpers (Pattern B):
each factory stays a separate, greppable function and composes these
primitives — provider-specific quirks (e.g. confluence's `/wiki` strip)
remain inline in the factory that owns them.
"""

from __future__ import annotations

import os
from base64 import b64encode
from typing import Any, Mapping

from fetch_http_client import APIKeyAuth, BasicAuth, BearerAuth, Proxy, ProxyAuth


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


# ----------------------------------------------------------------------------
# cfg-slice composition helpers (Pattern B)
# ----------------------------------------------------------------------------


def resolve_base_url(slice_: Mapping[str, Any]) -> str:
    """Return the post-pipeline `base_url` from a provider cfg slice.

    Raises if the slice has no resolved URL — that means yaml didn't
    define one and `overwrite_from_context` didn't fill it in either,
    which is a configuration bug, not a runtime fallback condition.
    """
    base = slice_.get("base_url")
    if not base:
        raise RuntimeError(
            f"missing base_url in cfg slice; check yaml + overwrite_from_context"
        )
    return base


def resolve_auth(slice_: Mapping[str, Any]) -> Any:
    """Pick the fetch_http_client Auth instance from a cfg slice.

    Maps yaml `endpoint_auth_type` to the corresponding Auth class:
        - bearer            -> BearerAuth(endpoint_api_key)
        - basic_email_token -> BasicAuth(email, endpoint_api_key)
        - basic             -> BasicAuth(username, endpoint_api_key)
        - custom            -> APIKeyAuth(endpoint_api_key, api_auth_header_name)
        - custom_header     -> APIKeyAuth(endpoint_api_key, api_auth_header_name)
    """
    auth_type = slice_.get("endpoint_auth_type")
    token = slice_.get("endpoint_api_key")
    if auth_type == "bearer":
        return BearerAuth(token)
    if auth_type == "basic_email_token":
        return BasicAuth(slice_["email"], token)
    if auth_type == "basic":
        return BasicAuth(slice_["username"], token)
    if auth_type in ("custom", "custom_header"):
        return APIKeyAuth(token, slice_["api_auth_header_name"])
    raise RuntimeError(f"unsupported endpoint_auth_type: {auth_type!r}")


def resolve_static_headers(slice_: Mapping[str, Any]) -> dict:
    """Return the static (non-templated) headers from a cfg slice.

    Strips keys whose value is None — those are placeholders for
    per-request templates handled by the build_echo helper, not the
    AsyncClient.
    """
    headers = slice_.get("headers") or {}
    return {k: v for k, v in headers.items() if v is not None}


def with_proxy_kwargs(opts: dict) -> dict:
    """Attach a Proxy to an AsyncClient kwargs dict if the env says so.

    Mirrors `_kwargs_with_proxy` from the pre-refactor factories: reads
    `HTTPS_PROXY` / `HTTP_PROXY` from the environment via `build_proxy({})`.
    Per-provider yaml `proxy_url` is not consumed here yet — that's a
    follow-up if/when proxy semantics need to be config-driven.
    """
    proxy = build_proxy({})
    if proxy is not None:
        opts["proxy"] = proxy
    return opts
