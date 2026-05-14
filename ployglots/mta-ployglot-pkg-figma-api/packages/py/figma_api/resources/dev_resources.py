"""Dev Resources — Figma REST API coverage.

Tier: basic. Dev Mode resources link nodes to external URLs.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any
from urllib.parse import quote

if TYPE_CHECKING:
    from .._figma_client import FigmaClient


class DevResourcesResource:
    def __init__(self, client: FigmaClient) -> None:
        self._client = client

    async def list(
        self, file_key: str, node_ids: list[str] | None = None
    ) -> dict[str, Any]:
        """GET /v1/files/:file_key/dev_resources — dev resources scoped to a file."""
        params: dict[str, Any] = {}
        if node_ids:
            params["node_ids"] = ",".join(node_ids)
        return await self._client.get(
            f"/v1/files/{quote(file_key, safe='')}/dev_resources", params=params
        )

    async def create(self, items: list[dict[str, Any]]) -> dict[str, Any]:
        """POST /v1/dev_resources — bulk-create."""
        return await self._client.post("/v1/dev_resources", json={"dev_resources": items})

    async def update(self, items: list[dict[str, Any]]) -> dict[str, Any]:
        """PUT /v1/dev_resources — bulk-update (mapped to POST by the client)."""
        return await self._client.post("/v1/dev_resources", json={"dev_resources": items})

    async def delete(self, file_key: str, dev_resource_id: str) -> None:
        """DELETE /v1/files/:file_key/dev_resources/:id — delete one."""
        await self._client.delete(
            f"/v1/files/{quote(file_key, safe='')}/dev_resources/"
            f"{quote(dev_resource_id, safe='')}"
        )
