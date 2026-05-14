"""Server pattern #3 — FastAPI **middleware**.

Middleware runs before and after every request. Useful for: stashing
a per-request SDK instance, capturing timing, translating
``FigmaError`` subclasses into HTTP status codes uniformly.

This example shows all three:

  1. ``figma_middleware`` attaches a shared client to ``request.state``.
  2. ``timing_middleware`` records duration.
  3. An ``exception_handler`` maps ``FigmaRateLimitError`` → 429,
     ``FigmaAuthError`` → 401/403, etc.

Run:
    FIGMA_PASS=$TOKEN uvicorn examples.servers.fastapi_middleware:app --reload
"""

from __future__ import annotations

import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from figma_api import (
    FigmaAuthError,
    FigmaClient,
    FigmaError,
    FigmaNotFoundError,
    FigmaRateLimitError,
)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.figma = FigmaClient(proxy={})
    try:
        yield
    finally:
        await app.state.figma.aclose()


app = FastAPI(lifespan=lifespan)


@app.middleware("http")
async def figma_middleware(request: Request, call_next):
    # Stash the client on the request scope so handlers can grab it.
    request.state.figma = request.app.state.figma
    return await call_next(request)


@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    response.headers["x-elapsed-ms"] = f"{(time.perf_counter() - start) * 1000:.1f}"
    return response


@app.exception_handler(FigmaError)
async def figma_exception_handler(_request: Request, exc: FigmaError) -> JSONResponse:
    if isinstance(exc, FigmaRateLimitError):
        headers = {}
        if exc.retry_after_seconds is not None:
            headers["retry-after"] = str(exc.retry_after_seconds)
        return JSONResponse({"error": str(exc)}, status_code=429, headers=headers)
    if isinstance(exc, FigmaAuthError):
        return JSONResponse({"error": str(exc)}, status_code=exc.status)
    if isinstance(exc, FigmaNotFoundError):
        return JSONResponse({"error": str(exc)}, status_code=404)
    return JSONResponse({"error": str(exc)}, status_code=502)


@app.get("/me")
async def me(request: Request) -> dict:
    client: FigmaClient = request.state.figma
    return await client.me.get()
