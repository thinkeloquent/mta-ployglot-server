"""Webhooks (v2) — Figma REST API coverage.

Tier: basic. Webhook endpoints sit under ``/v2/`` (not ``/v1/``).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any
from urllib.parse import quote

if TYPE_CHECKING:
    from .._figma_client import FigmaClient


class WebhooksResource:
    def __init__(self, client: FigmaClient) -> None:
        self._client = client

    async def create(self, body: dict[str, Any]) -> dict[str, Any]:
        """POST /v2/webhooks — create."""
        return await self._client.post("/v2/webhooks", json=body)

    async def get(self, webhook_id: str) -> dict[str, Any]:
        """GET /v2/webhooks/:id — fetch one."""
        return await self._client.get(f"/v2/webhooks/{quote(webhook_id, safe='')}")

    async def update(self, webhook_id: str, body: dict[str, Any]) -> dict[str, Any]:
        """PUT /v2/webhooks/:id — update (mapped to POST via FetchClient)."""
        return await self._client.post(
            f"/v2/webhooks/{quote(webhook_id, safe='')}", json=body
        )

    async def delete(self, webhook_id: str) -> None:
        """DELETE /v2/webhooks/:id — delete."""
        await self._client.delete(f"/v2/webhooks/{quote(webhook_id, safe='')}")

    async def list_for_team(self, team_id: str) -> dict[str, Any]:
        """GET /v2/teams/:team_id/webhooks — all webhooks for a team."""
        return await self._client.get(f"/v2/teams/{quote(team_id, safe='')}/webhooks")

    async def requests(self, webhook_id: str) -> dict[str, Any]:
        """GET /v2/webhooks/:id/requests — recent deliveries."""
        return await self._client.get(
            f"/v2/webhooks/{quote(webhook_id, safe='')}/requests"
        )
