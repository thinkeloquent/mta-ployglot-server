"""Variables — Figma REST API coverage.

Tier: enterprise only. Returns 403 without an Enterprise/Org plan.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any
from urllib.parse import quote

if TYPE_CHECKING:
    from .._figma_client import FigmaClient


class VariablesResource:
    def __init__(self, client: FigmaClient) -> None:
        self._client = client

    async def list_local(self, file_key: str) -> dict[str, Any]:
        """GET /v1/files/:file_key/variables/local — local variables."""
        return await self._client.get(
            f"/v1/files/{quote(file_key, safe='')}/variables/local"
        )

    async def list_published(self, file_key: str) -> dict[str, Any]:
        """GET /v1/files/:file_key/variables/published — published variables."""
        return await self._client.get(
            f"/v1/files/{quote(file_key, safe='')}/variables/published"
        )

    async def post_variables(self, file_key: str, body: dict[str, Any]) -> dict[str, Any]:
        """POST /v1/files/:file_key/variables — upsert variables / collections / modes."""
        return await self._client.post(
            f"/v1/files/{quote(file_key, safe='')}/variables", json=body
        )
