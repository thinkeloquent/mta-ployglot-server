"""Per-provider factories returning configured AsyncClient instances."""

from __future__ import annotations

from fetch_http_client import APIKeyAuth, AsyncClient, BasicAuth, BearerAuth

from ._shared_fetch import build_proxy, optional_env, require_env


def _kwargs_with_proxy(base: dict) -> dict:
    proxy = build_proxy({})
    if proxy is not None:
        base["proxy"] = proxy
    return base


async def make_jira_client() -> AsyncClient:
    return AsyncClient(**_kwargs_with_proxy({
        "base_url": require_env("JIRA_BASE_URL"),
        "auth": BasicAuth(require_env("JIRA_EMAIL"), require_env("JIRA_API_TOKEN")),
        "headers": {"accept": "application/json"},
    }))


async def make_confluence_client() -> AsyncClient:
    # Strip a trailing `/wiki` (and any trailing slash) from the env so route paths
    # can carry the full `/wiki/rest/api/...` prefix without double-prefixing
    # when CONFLUENCE_BASE_URL is set to `https://<tenant>.atlassian.net/wiki`.
    base_url = require_env("CONFLUENCE_BASE_URL").rstrip("/")
    if base_url.endswith("/wiki"):
        base_url = base_url[: -len("/wiki")]
    # Atlassian Cloud Basic auth username is the account email. The platform
    # reference (server.dev.yaml + env_resolver.env_confluence_x) reads it from
    # CONFLUENCE_USERNAME; older docs use CONFLUENCE_EMAIL. Accept either.
    username = optional_env("CONFLUENCE_USERNAME", "") or require_env("CONFLUENCE_EMAIL")
    return AsyncClient(**_kwargs_with_proxy({
        "base_url": base_url,
        "auth": BasicAuth(username, require_env("CONFLUENCE_API_TOKEN")),
        "headers": {
            "accept": "application/json",
            "content-type": "application/json",
            "x-atlassian-token": "no-check",
        },
    }))


async def make_github_client() -> AsyncClient:
    return AsyncClient(**_kwargs_with_proxy({
        "base_url": optional_env("GITHUB_API_BASE_URL", "https://api.github.com"),
        "auth": BearerAuth(require_env("GITHUB_TOKEN")),
        "headers": {
            "accept": "application/vnd.github+json",
            "x-github-api-version": "2022-11-28",
        },
    }))


async def make_figma_client() -> AsyncClient:
    return AsyncClient(**_kwargs_with_proxy({
        "base_url": optional_env("FIGMA_API_BASE_URL", "https://api.figma.com"),
        "auth": APIKeyAuth(require_env("FIGMA_TOKEN"), "X-Figma-Token"),
        "headers": {"accept": "application/json"},
    }))


async def make_statsig_client() -> AsyncClient:
    return AsyncClient(**_kwargs_with_proxy({
        "base_url": optional_env("STATSIG_BASE_URL", "https://statsigapi.net/console/v1"),
        "auth": APIKeyAuth(require_env("STATSIG_API_KEY"), "STATSIG-API-KEY"),
        "headers": {"accept": "application/json"},
    }))


async def make_saucelabs_client() -> AsyncClient:
    return AsyncClient(**_kwargs_with_proxy({
        "base_url": optional_env("SAUCELABS_BASE_URL", "https://api.us-west-1.saucelabs.com"),
        "auth": BasicAuth(require_env("SAUCE_USERNAME"), require_env("SAUCE_ACCESS_KEY")),
        "headers": {"accept": "application/json"},
    }))


FACTORIES = {
    "jira": make_jira_client,
    "confluence": make_confluence_client,
    "github": make_github_client,
    "figma": make_figma_client,
    "statsig": make_statsig_client,
    "saucelabs": make_saucelabs_client,
}
