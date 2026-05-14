"""Components / Component Sets / Styles — Figma REST API coverage.

Tier: basic.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any
from urllib.parse import quote

if TYPE_CHECKING:
    from .._figma_client import FigmaClient


def _page(
    page_size: int | None = None,
    after: str | int | None = None,
    before: str | int | None = None,
) -> dict[str, Any]:
    params: dict[str, Any] = {}
    if page_size is not None:
        params["page_size"] = page_size
    if after is not None:
        params["after"] = after
    if before is not None:
        params["before"] = before
    return params


class ComponentsResource:
    def __init__(self, client: FigmaClient) -> None:
        self._client = client

    async def list_for_team(
        self,
        team_id: str,
        *,
        page_size: int | None = None,
        after: str | int | None = None,
        before: str | int | None = None,
    ) -> dict[str, Any]:
        """GET /v1/teams/:team_id/components — published components."""
        return await self._client.get(
            f"/v1/teams/{quote(team_id, safe='')}/components",
            params=_page(page_size, after, before),
        )

    async def list_for_file(self, file_key: str) -> dict[str, Any]:
        """GET /v1/files/:key/components — components defined in a file."""
        return await self._client.get(f"/v1/files/{quote(file_key, safe='')}/components")

    async def get(self, component_key: str) -> dict[str, Any]:
        """GET /v1/components/:key — fetch a published component by key."""
        return await self._client.get(f"/v1/components/{quote(component_key, safe='')}")

    async def list_component_sets_for_team(
        self,
        team_id: str,
        *,
        page_size: int | None = None,
        after: str | int | None = None,
        before: str | int | None = None,
    ) -> dict[str, Any]:
        """GET /v1/teams/:team_id/component_sets — published component sets."""
        return await self._client.get(
            f"/v1/teams/{quote(team_id, safe='')}/component_sets",
            params=_page(page_size, after, before),
        )

    async def list_component_sets_for_file(self, file_key: str) -> dict[str, Any]:
        """GET /v1/files/:key/component_sets — component sets inside a file."""
        return await self._client.get(
            f"/v1/files/{quote(file_key, safe='')}/component_sets"
        )

    async def get_component_set(self, set_key: str) -> dict[str, Any]:
        """GET /v1/component_sets/:key — single component set."""
        return await self._client.get(f"/v1/component_sets/{quote(set_key, safe='')}")

    async def list_styles_for_team(
        self,
        team_id: str,
        *,
        page_size: int | None = None,
        after: str | int | None = None,
        before: str | int | None = None,
    ) -> dict[str, Any]:
        """GET /v1/teams/:team_id/styles — published styles."""
        return await self._client.get(
            f"/v1/teams/{quote(team_id, safe='')}/styles",
            params=_page(page_size, after, before),
        )

    async def list_styles_for_file(self, file_key: str) -> dict[str, Any]:
        """GET /v1/files/:key/styles — styles inside a single file."""
        return await self._client.get(f"/v1/files/{quote(file_key, safe='')}/styles")

    async def get_style(self, style_key: str) -> dict[str, Any]:
        """GET /v1/styles/:key — single style."""
        return await self._client.get(f"/v1/styles/{quote(style_key, safe='')}")
