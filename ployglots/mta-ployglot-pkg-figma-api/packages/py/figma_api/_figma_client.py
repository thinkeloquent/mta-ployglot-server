"""FigmaClient — the top-level async SDK entry point."""

from __future__ import annotations

from typing import Any

from ._config import FigmaConfig, resolve_figma_config
from ._errors import FigmaError, FigmaErrorContext, map_http_error
from ._fetch_client import FetchClient, create_default_fetch_client
from ._logger import Logger, create_logger
from .resources.comments import CommentsResource
from .resources.components import ComponentsResource
from .resources.dev_resources import DevResourcesResource
from .resources.files import FilesResource
from .resources.library_analytics import LibraryAnalyticsResource
from .resources.me import MeResource
from .resources.projects import ProjectsResource
from .resources.variables import VariablesResource
from .resources.webhooks import WebhooksResource


class FigmaClient:
    """Async Figma API client.

    Usage::

        async with FigmaClient(proxy={}) as client:
            me = await client.me.get()
    """

    def __init__(
        self,
        *,
        token: str | None = None,
        host: str | None = None,
        user: str | None = None,
        proxy: dict[str, Any] | None = None,
        timeout_ms: int = 30_000,
        default_headers: dict[str, str] | None = None,
        retry: dict[str, Any] | bool | None = None,
        force_overwrite_retry: bool = False,
        fetch_client: FetchClient | None = None,
        logger: Logger | None = None,
    ) -> None:
        self.config: FigmaConfig = resolve_figma_config(
            token=token,
            host=host,
            user=user,
            proxy=proxy,
            timeout_ms=timeout_ms,
            default_headers=default_headers,
            retry=retry,
            force_overwrite_retry=force_overwrite_retry,
        )
        self.fetch_client: FetchClient = fetch_client or create_default_fetch_client(self.config)
        self.logger: Logger = logger or create_logger(prefix="figma-api")

        self.me = MeResource(self)
        self.files = FilesResource(self)
        self.comments = CommentsResource(self)
        self.projects = ProjectsResource(self)
        self.components = ComponentsResource(self)
        self.variables = VariablesResource(self)
        self.dev_resources = DevResourcesResource(self)
        self.library_analytics = LibraryAnalyticsResource(self)
        self.webhooks = WebhooksResource(self)

    async def get(self, path: str, **kwargs: Any) -> Any:
        return await self._request("GET", path, **kwargs)

    async def post(self, path: str, **kwargs: Any) -> Any:
        return await self._request("POST", path, **kwargs)

    async def delete(self, path: str, allow_empty: bool = True, **kwargs: Any) -> Any:
        return await self._request("DELETE", path, allow_empty=allow_empty, **kwargs)

    async def _request(
        self, method: str, path: str, *, allow_empty: bool = False, **kwargs: Any
    ) -> Any:
        verb = getattr(self.fetch_client, method.lower())
        resp = await verb(path, **kwargs)
        status = int(getattr(resp, "status_code", getattr(resp, "status", 0)))
        if status >= 400:
            body = ""
            try:
                body = getattr(resp, "text", "") or ""
                if callable(body):
                    body = body()
            except Exception:
                body = ""
            retry_after = None
            try:
                retry_after = resp.headers.get("retry-after")
            except Exception:
                retry_after = None
            raise map_http_error(
                FigmaErrorContext(
                    method=method,
                    url=path,
                    status=status,
                    body=str(body or ""),
                    retry_after=retry_after,
                )
            )
        try:
            return resp.json()
        except Exception as err:
            if allow_empty:
                return None
            raise FigmaError(f"{method} {path} → failed to decode JSON") from err

    async def aclose(self) -> None:
        close = getattr(self.fetch_client, "aclose", None)
        if close is not None:
            await close()

    async def __aenter__(self) -> FigmaClient:
        return self

    async def __aexit__(self, exc_type: object, exc: object, tb: object) -> None:
        await self.aclose()
