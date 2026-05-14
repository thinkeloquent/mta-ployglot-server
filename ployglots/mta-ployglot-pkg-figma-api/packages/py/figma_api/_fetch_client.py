"""Pluggable FetchClient contract — the only transport surface
FigmaClient depends on. The default implementation wraps the
``polyglot-fetch-http-client`` ``AsyncClient``; callers can swap in
their own for BYO compositions.
"""

from __future__ import annotations

from typing import Any, Protocol

from fetch_http_client import APIKeyAuth, AsyncClient

from ._config import FigmaConfig, resolve_figma_config
from ._proxy import build_proxy
from ._retry import build_figma_retry_config
from ._version import __version__


class FetchClient(Protocol):
    async def get(self, path: str, **kwargs: Any) -> Any: ...
    async def post(self, path: str, **kwargs: Any) -> Any: ...
    async def put(self, path: str, **kwargs: Any) -> Any: ...
    async def delete(self, path: str, **kwargs: Any) -> Any: ...
    async def patch(self, path: str, **kwargs: Any) -> Any: ...
    async def aclose(self) -> None: ...


def create_default_fetch_client(config: FigmaConfig) -> AsyncClient:
    """Build the default Figma FetchClient from a resolved config."""
    proxy = build_proxy(config.proxy)

    # `retry=None` passed to FigmaClient means "use Figma defaults".
    # `retry=False` means "disable". Pass-through dict gets merged.
    retry_input = config.retry if config.retry is not None else {}
    retry = build_figma_retry_config(
        retry_input, force_overwrite=config.force_overwrite_retry
    )

    kwargs: dict[str, Any] = {
        "base_url": config.host,
        "auth": APIKeyAuth(config.token, "X-Figma-Token"),
        "timeout": config.timeout_ms / 1000.0,
        "headers": {
            "accept": "application/json",
            "user-agent": f"polyglot-figma-api/{__version__}",
            **config.default_headers,
        },
    }
    if proxy is not None:
        kwargs["proxy"] = proxy
    if retry is not None:
        kwargs["retry"] = retry
    return AsyncClient(**kwargs)


def fetch_client_from_polyglot(inner: AsyncClient) -> AsyncClient:
    """Helper for the BYO pattern — returns the AsyncClient verbatim.

    Kept as a named function so callers can be explicit about intent and
    so the twin surface matches ``fetchClientFromPolyglot`` on the ts
    side.
    """
    return inner


def create_figma_fetch_client(**kwargs: Any) -> AsyncClient:
    """Build a ready-to-use default FetchClient from config inputs."""
    return create_default_fetch_client(resolve_figma_config(**kwargs))
