from __future__ import annotations

from typing import TYPE_CHECKING, Any
from urllib.parse import quote

if TYPE_CHECKING:
    from .._figma_client import FigmaClient


class ProjectsResource:
    def __init__(self, client: FigmaClient) -> None:
        self._client = client

    async def list_for_team(self, team_id: str) -> dict[str, Any]:
        """GET /v1/teams/:team_id/projects — projects owned by a team."""
        return await self._client.get(f"/v1/teams/{quote(team_id, safe='')}/projects")

    async def list_files(self, project_id: str) -> dict[str, Any]:
        """GET /v1/projects/:project_id/files — files inside a project."""
        return await self._client.get(f"/v1/projects/{quote(project_id, safe='')}/files")
