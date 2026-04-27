"""GET /healthz/integrations/figma/me — proxy of upstream /v1/me."""

from __future__ import annotations

import os

from fastapi import APIRouter, Depends, Response, status
from fetch_http_client import AsyncClient

from ._di import get_figma_client


def mount(_app, _config) -> APIRouter:
    router = APIRouter()

    @router.get("/healthz/integrations/figma/me")
    async def figma_me(
        response: Response,
        client: AsyncClient = Depends(get_figma_client),
    ):
        try:
            upstream = await client.get("/v1/me")
        except Exception as exc:  # noqa: BLE001
            response.status_code = status.HTTP_502_BAD_GATEWAY
            return {"service": "figma", "connected": False, "error": str(exc)}
        if upstream.status_code >= 400:
            response.status_code = status.HTTP_502_BAD_GATEWAY
            return {
                "service": "figma",
                "connected": False,
                "upstream_status": upstream.status_code,
                "upstream_body": upstream.text[:512] if hasattr(upstream, "text") else "",
            }
        return {
            "service": "figma",
            "connected": True,
            "host": os.environ.get("FIGMA_API_BASE_URL", "https://api.figma.com"),
            "data": upstream.json(),
        }

    return router
