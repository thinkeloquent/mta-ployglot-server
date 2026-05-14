"""Server pattern #2 — FastAPI **dependency injection**.

Instead of reaching into ``app.state`` in every handler, expose the
SDK via a dependency. This makes handlers trivially testable (override
the dependency with a fake FetchClient in tests) and lets you layer
per-request policies (rate-limit bucket, tenant routing) under one
dependency.

Run:
    FIGMA_PASS=$TOKEN uvicorn examples.servers.fastapi_dependency:app --reload
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI

from figma_api import FigmaClient

_CLIENT: FigmaClient | None = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    global _CLIENT
    _CLIENT = FigmaClient(proxy={})
    try:
        yield
    finally:
        await _CLIENT.aclose()
        _CLIENT = None


async def get_figma() -> FigmaClient:
    """Dependency: returns the shared SDK instance.

    Overrideable in tests via ``app.dependency_overrides[get_figma] = ...``.
    """
    if _CLIENT is None:
        raise RuntimeError("FigmaClient is not initialised (lifespan not running)")
    return _CLIENT


app = FastAPI(lifespan=lifespan)

FigmaDep = Annotated[FigmaClient, Depends(get_figma)]


@app.get("/me")
async def me(figma: FigmaDep) -> dict:
    return await figma.me.get()


@app.get("/projects/teams/{team_id}")
async def team_projects(team_id: str, figma: FigmaDep) -> dict:
    return await figma.projects.list_for_team(team_id)
