"""Wildcard index. Catches any path not handled by an earlier route.

Numeric prefix `99_` ensures this loads last so specific routes like /healthz,
/health, and /_reports register first and take precedence in Starlette's
order-dependent route matching.

Surface contract: GET-only, mirroring the Fastify twin's `fastify.get("/*", ...)`.
The Starlette path converter `{full_path:path}` is the FastAPI/Starlette
equivalent of Fastify's `*` — twin-surface.sh normalizes the two forms so
twin-diff sees them as equal.
"""

import os

from fastapi import APIRouter, Request


def _index_payload(config, request: Request) -> dict:
    return {
        "service": config.title,
        "profile": config.profile,
        "method": request.method,
        "path": request.url.path,
        "endpoints": ["/health", "/healthz", "/_reports"],
        "build_id": os.environ.get("BUILD_ID"),
        "build_version": os.environ.get("BUILD_VERSION"),
    }


def mount(app, config) -> APIRouter:
    router = APIRouter()

    @router.get("/")
    async def index(request: Request):
        return _index_payload(config, request)

    @router.get("/{full_path:path}")
    async def wildcard(full_path: str, request: Request):
        return _index_payload(config, request)

    return router
