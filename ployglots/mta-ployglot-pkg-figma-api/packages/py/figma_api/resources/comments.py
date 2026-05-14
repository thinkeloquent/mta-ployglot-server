from __future__ import annotations

from typing import TYPE_CHECKING, Any
from urllib.parse import quote

if TYPE_CHECKING:
    from .._figma_client import FigmaClient


class CommentsResource:
    def __init__(self, client: FigmaClient) -> None:
        self._client = client

    async def list(self, file_key: str) -> list[dict[str, Any]]:
        """GET /v1/files/:key/comments — all comments on a file."""
        resp = await self._client.get(f"/v1/files/{quote(file_key, safe='')}/comments")
        return resp.get("comments", []) if isinstance(resp, dict) else []

    async def create(
        self,
        file_key: str,
        *,
        message: str,
        client_meta: Any = None,
        comment_id: str | None = None,
    ) -> dict[str, Any]:
        """POST /v1/files/:key/comments — create a comment."""
        body: dict[str, Any] = {"message": message}
        if client_meta is not None:
            body["client_meta"] = client_meta
        if comment_id is not None:
            body["comment_id"] = comment_id
        return await self._client.post(
            f"/v1/files/{quote(file_key, safe='')}/comments",
            json=body,
        )

    async def delete(self, file_key: str, comment_id: str) -> None:
        """DELETE /v1/files/:key/comments/:id — delete a comment."""
        await self._client.delete(
            f"/v1/files/{quote(file_key, safe='')}/comments/{quote(comment_id, safe='')}"
        )

    async def reactions(self, file_key: str, comment_id: str) -> dict[str, Any]:
        """GET /v1/files/:key/comments/:id/reactions — list reactions on a comment."""
        return await self._client.get(
            f"/v1/files/{quote(file_key, safe='')}/comments/"
            f"{quote(comment_id, safe='')}/reactions"
        )

    async def add_reaction(
        self, file_key: str, comment_id: str, emoji: str
    ) -> dict[str, Any]:
        """POST /v1/files/:key/comments/:id/reactions — add a reaction."""
        return await self._client.post(
            f"/v1/files/{quote(file_key, safe='')}/comments/"
            f"{quote(comment_id, safe='')}/reactions",
            json={"emoji": emoji},
        )

    async def remove_reaction(self, file_key: str, comment_id: str, emoji: str) -> None:
        """DELETE /v1/files/:key/comments/:id/reactions — remove a reaction."""
        await self._client.delete(
            f"/v1/files/{quote(file_key, safe='')}/comments/"
            f"{quote(comment_id, safe='')}/reactions",
            params={"emoji": emoji},
        )
