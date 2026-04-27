"""GET /healthz/integrations/github/user — proxy of upstream /user."""

from __future__ import annotations

import os

from fastapi import APIRouter, Depends, Response, status
from fetch_http_client import AsyncClient

from ._di import get_github_client


def mount(_app, _config) -> APIRouter:
    router = APIRouter()

    @router.get("/healthz/integrations/github/user")
    async def github_user(
        response: Response,
        client: AsyncClient = Depends(get_github_client),
    ):
        try:
            upstream = await client.get("/user")
        except Exception as exc:  # noqa: BLE001
            response.status_code = status.HTTP_502_BAD_GATEWAY
            return {"service": "github", "connected": False, "error": str(exc)}
        if upstream.status_code >= 400:
            response.status_code = status.HTTP_502_BAD_GATEWAY
            return {
                "service": "github",
                "connected": False,
                "upstream_status": upstream.status_code,
                "upstream_body": upstream.text[:512] if hasattr(upstream, "text") else "",
            }
        return {
            "service": "github",
            "connected": True,
            "host": os.environ.get("GITHUB_API_BASE_URL", "https://api.github.com"),
            "data": upstream.json(),
        }

    return router
