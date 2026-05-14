"""Server pattern #1 — FastAPI **lifespan** context.

The lifespan context is the modern (post-deprecation of ``on_event``)
way to wire resources that live for the whole app lifetime. One
shared ``FigmaClient`` is created on startup and closed on shutdown.

Install:
    pip install fastapi uvicorn polyglot-figma-api

Run:
    FIGMA_PASS=$TOKEN uvicorn examples.servers.fastapi_lifespan:app --reload
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request

from figma_api import FigmaClient


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Startup: one shared client for the app lifetime.
    client = FigmaClient(proxy={})
    app.state.figma = client
    try:
        yield
    finally:
        # Shutdown: close cleanly.
        await client.aclose()


app = FastAPI(lifespan=lifespan)


@app.get("/me")
async def me(request: Request) -> dict:
    client: FigmaClient = request.app.state.figma
    return await client.me.get()


@app.get("/files/{key}")
async def get_file(key: str, request: Request) -> dict:
    client: FigmaClient = request.app.state.figma
    return await client.files.get(key, depth=1)
