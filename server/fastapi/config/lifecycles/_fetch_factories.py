"""Per-provider factories returning configured AsyncClient instances.

Each `make_<provider>_client` reads its slice from the post-pipeline
`get_config()["providers"][<name>]` and composes an AsyncClient via the
shared helpers in `_shared_fetch.py`. The yaml is the single source of
truth for base URLs, auth tokens (resolved at boot via
`{{fn:provider_api_keys.<name>}}`), credentials (`email` / `username`),
and static headers — no env reads here.

Pattern B: factories stay separate, named functions for greppability;
shared logic lives in helpers; provider-specific quirks
(e.g. confluence's `/wiki` strip) stay visible inline.
"""

from __future__ import annotations

from app_yaml_fetch_config import get_config
from fetch_http_client import AsyncClient

from ._shared_fetch import (
    resolve_auth,
    resolve_base_url,
    resolve_static_headers,
    with_proxy_kwargs,
)


def _slice(name: str) -> dict:
    cfg = get_config()
    providers = cfg.get("providers") if isinstance(cfg, dict) else None
    slice_ = (providers or {}).get(name)
    if not slice_:
        raise RuntimeError(
            f"cfg.providers.{name} is missing; check server.dev.yaml and slot 29 wiring"
        )
    return slice_


async def make_jira_client() -> AsyncClient:
    slice_ = _slice("jira")
    return AsyncClient(**with_proxy_kwargs({
        "base_url": resolve_base_url(slice_),
        "auth":     resolve_auth(slice_),
        "headers":  resolve_static_headers(slice_),
    }))


async def make_confluence_client() -> AsyncClient:
    slice_ = _slice("confluence")
    # Strip a trailing `/wiki` (and any trailing slash) from the resolved
    # base_url so route paths can carry the full `/wiki/rest/api/...`
    # prefix without double-prefixing when the yaml-resolved value is
    # `https://<tenant>.atlassian.net/wiki`. The yaml `base_url` stays
    # the configured value; only the AsyncClient kwarg is normalised.
    base_url = resolve_base_url(slice_).rstrip("/")
    if base_url.endswith("/wiki"):
        base_url = base_url[: -len("/wiki")]
    return AsyncClient(**with_proxy_kwargs({
        "base_url": base_url,
        "auth":     resolve_auth(slice_),
        "headers":  resolve_static_headers(slice_),
    }))


async def make_github_client() -> AsyncClient:
    slice_ = _slice("github")
    return AsyncClient(**with_proxy_kwargs({
        "base_url": resolve_base_url(slice_),
        "auth":     resolve_auth(slice_),
        "headers":  resolve_static_headers(slice_),
    }))


async def make_figma_client() -> AsyncClient:
    slice_ = _slice("figma")
    return AsyncClient(**with_proxy_kwargs({
        "base_url": resolve_base_url(slice_),
        "auth":     resolve_auth(slice_),
        "headers":  resolve_static_headers(slice_),
    }))


async def make_statsig_client() -> AsyncClient:
    slice_ = _slice("statsig")
    return AsyncClient(**with_proxy_kwargs({
        "base_url": resolve_base_url(slice_),
        "auth":     resolve_auth(slice_),
        "headers":  resolve_static_headers(slice_),
    }))


async def make_saucelabs_client() -> AsyncClient:
    slice_ = _slice("saucelabs")
    return AsyncClient(**with_proxy_kwargs({
        "base_url": resolve_base_url(slice_),
        "auth":     resolve_auth(slice_),
        "headers":  resolve_static_headers(slice_),
    }))


FACTORIES = {
    "jira": make_jira_client,
    "confluence": make_confluence_client,
    "github": make_github_client,
    "figma": make_figma_client,
    "statsig": make_statsig_client,
    "saucelabs": make_saucelabs_client,
}
