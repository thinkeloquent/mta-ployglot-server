"""Library Analytics — Figma REST API coverage.

Tier: enterprise only.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any
from urllib.parse import quote

if TYPE_CHECKING:
    from .._figma_client import FigmaClient


def _flatten(
    *,
    group_by: str,
    cursor: str | None = None,
    order: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
) -> dict[str, Any]:
    params: dict[str, Any] = {"group_by": group_by}
    if cursor is not None:
        params["cursor"] = cursor
    if order is not None:
        params["order"] = order
    if start_date is not None:
        params["start_date"] = start_date
    if end_date is not None:
        params["end_date"] = end_date
    return params


class LibraryAnalyticsResource:
    def __init__(self, client: FigmaClient) -> None:
        self._client = client

    async def component_actions(self, file_key: str, *, group_by: str, **kwargs: Any) -> dict[str, Any]:
        return await self._client.get(
            f"/v1/analytics/libraries/{quote(file_key, safe='')}/component/actions",
            params=_flatten(group_by=group_by, **kwargs),
        )

    async def component_usages(self, file_key: str, *, group_by: str, **kwargs: Any) -> dict[str, Any]:
        return await self._client.get(
            f"/v1/analytics/libraries/{quote(file_key, safe='')}/component/usages",
            params=_flatten(group_by=group_by, **kwargs),
        )

    async def style_actions(self, file_key: str, *, group_by: str, **kwargs: Any) -> dict[str, Any]:
        return await self._client.get(
            f"/v1/analytics/libraries/{quote(file_key, safe='')}/style/actions",
            params=_flatten(group_by=group_by, **kwargs),
        )

    async def style_usages(self, file_key: str, *, group_by: str, **kwargs: Any) -> dict[str, Any]:
        return await self._client.get(
            f"/v1/analytics/libraries/{quote(file_key, safe='')}/style/usages",
            params=_flatten(group_by=group_by, **kwargs),
        )

    async def variable_actions(self, file_key: str, *, group_by: str, **kwargs: Any) -> dict[str, Any]:
        return await self._client.get(
            f"/v1/analytics/libraries/{quote(file_key, safe='')}/variable/actions",
            params=_flatten(group_by=group_by, **kwargs),
        )

    async def variable_usages(self, file_key: str, *, group_by: str, **kwargs: Any) -> dict[str, Any]:
        return await self._client.get(
            f"/v1/analytics/libraries/{quote(file_key, safe='')}/variable/usages",
            params=_flatten(group_by=group_by, **kwargs),
        )
