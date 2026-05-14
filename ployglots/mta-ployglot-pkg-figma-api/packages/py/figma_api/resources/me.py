from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .._figma_client import FigmaClient


class MeResource:
    def __init__(self, client: FigmaClient) -> None:
        self._client = client

    async def get(self) -> dict[str, Any]:
        """GET /v1/me — authenticated user."""
        return await self._client.get("/v1/me")
