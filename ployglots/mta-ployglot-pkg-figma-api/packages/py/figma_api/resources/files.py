from __future__ import annotations

from typing import TYPE_CHECKING, Any
from urllib.parse import quote

if TYPE_CHECKING:
    from .._figma_client import FigmaClient


def _stringify_params(options: dict[str, Any] | None) -> dict[str, Any]:
    options = options or {}
    params: dict[str, Any] = {}
    if options.get("version") is not None:
        params["version"] = options["version"]
    if options.get("ids"):
        params["ids"] = ",".join(options["ids"])
    if options.get("depth") is not None:
        params["depth"] = options["depth"]
    if options.get("geometry") is not None:
        params["geometry"] = options["geometry"]
    if options.get("plugin_data") is not None:
        params["plugin_data"] = options["plugin_data"]
    if options.get("branch_data") is not None:
        params["branch_data"] = options["branch_data"]
    return params


class FilesResource:
    def __init__(self, client: FigmaClient) -> None:
        self._client = client

    async def get(self, file_key: str, **options: Any) -> dict[str, Any]:
        """GET /v1/files/:key — full file document."""
        return await self._client.get(
            f"/v1/files/{quote(file_key, safe='')}",
            params=_stringify_params(options),
        )

    async def nodes(self, file_key: str, ids: list[str]) -> dict[str, Any]:
        """GET /v1/files/:key/nodes — subset of nodes."""
        return await self._client.get(
            f"/v1/files/{quote(file_key, safe='')}/nodes",
            params={"ids": ",".join(ids)},
        )

    async def images(
        self,
        file_key: str,
        ids: list[str],
        *,
        format: str | None = None,
        scale: float | None = None,
    ) -> dict[str, Any]:
        """GET /v1/images/:key — export image URLs for selected nodes."""
        params: dict[str, Any] = {"ids": ",".join(ids)}
        if format is not None:
            params["format"] = format
        if scale is not None:
            params["scale"] = scale
        return await self._client.get(
            f"/v1/images/{quote(file_key, safe='')}",
            params=params,
        )

    async def image_fills(self, file_key: str) -> dict[str, Any]:
        """GET /v1/files/:key/images — image fills uploaded to the file."""
        return await self._client.get(f"/v1/files/{quote(file_key, safe='')}/images")

    async def meta(self, file_key: str) -> dict[str, Any]:
        """GET /v1/files/:key/meta — file metadata."""
        return await self._client.get(f"/v1/files/{quote(file_key, safe='')}/meta")

    async def versions(
        self,
        file_key: str,
        *,
        page_size: int | None = None,
        before: str | None = None,
        after: str | None = None,
    ) -> dict[str, Any]:
        """GET /v1/files/:key/versions — version history (paginated)."""
        params: dict[str, Any] = {}
        if page_size is not None:
            params["page_size"] = page_size
        if before is not None:
            params["before"] = before
        if after is not None:
            params["after"] = after
        return await self._client.get(
            f"/v1/files/{quote(file_key, safe='')}/versions", params=params
        )
