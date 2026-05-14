"""polyglot-figma-api — async Figma REST API client on top of
``polyglot-fetch-http-client``.

Public surface:

- :class:`FigmaClient` — top-level SDK entry point.
- :func:`create_figma_fetch_client` — build a standalone FetchClient.
- :func:`fetch_client_from_polyglot` — wrap a user ``AsyncClient`` as a
  FetchClient (BYO).
- :func:`resolve_figma_config` — merge explicit options with env.
- :func:`build_proxy` — proxy helper (auto-detects from env).
- Typed error tree: :class:`FigmaError` + subclasses.

Quick start::

    import asyncio
    from figma_api import FigmaClient

    async def main():
        # `proxy={}` auto-detects from HTTPS_PROXY / HTTP_PROXY.
        # `token` falls back to env FIGMA_PASS.
        async with FigmaClient(proxy={}) as client:
            me = await client.me.get()
            print(f"@{me['handle']}")

    asyncio.run(main())
"""

from ._config import (
    DEFAULT_FIGMA_HOST,
    FigmaConfig,
    resolve_figma_config,
)
from ._errors import (
    FigmaAuthError,
    FigmaConfigError,
    FigmaError,
    FigmaNotFoundError,
    FigmaRateLimitError,
    FigmaServerError,
    FigmaTransportError,
    map_http_error,
)
from ._fetch_client import (
    FetchClient,
    create_default_fetch_client,
    create_figma_fetch_client,
    fetch_client_from_polyglot,
)
from ._figma_client import FigmaClient
from ._logger import Logger, create_logger, mask_token
from ._proxy import ProxyOptionsBag, build_proxy, optional_env, require_env
from ._retry import FIGMA_DEFAULT_RETRY, build_figma_retry_config
from ._version import __version__
from .resources.comments import CommentsResource
from .resources.components import ComponentsResource
from .resources.dev_resources import DevResourcesResource
from .resources.files import FilesResource
from .resources.library_analytics import LibraryAnalyticsResource
from .resources.me import MeResource
from .resources.projects import ProjectsResource
from .resources.variables import VariablesResource
from .resources.webhooks import WebhooksResource

__all__ = [
    "DEFAULT_FIGMA_HOST",
    "FIGMA_DEFAULT_RETRY",
    "CommentsResource",
    "ComponentsResource",
    "DevResourcesResource",
    "FetchClient",
    "FigmaAuthError",
    "FigmaClient",
    "FigmaConfig",
    "FigmaConfigError",
    "FigmaError",
    "FigmaNotFoundError",
    "FigmaRateLimitError",
    "FigmaServerError",
    "FigmaTransportError",
    "FilesResource",
    "LibraryAnalyticsResource",
    "Logger",
    "MeResource",
    "ProjectsResource",
    "ProxyOptionsBag",
    "VariablesResource",
    "WebhooksResource",
    "__version__",
    "build_figma_retry_config",
    "build_proxy",
    "create_default_fetch_client",
    "create_figma_fetch_client",
    "create_logger",
    "fetch_client_from_polyglot",
    "map_http_error",
    "mask_token",
    "optional_env",
    "require_env",
    "resolve_figma_config",
]
