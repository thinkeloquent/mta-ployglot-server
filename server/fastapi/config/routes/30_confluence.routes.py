"""GET /healthz/integrations/wiki/rest/api/user/current — proxy of upstream /wiki/rest/api/user/current."""

from __future__ import annotations

import os

from fastapi import APIRouter, Depends, Response, status
from fetch_http_client import AsyncClient

from ._di import get_confluence_client


def mount(_app, _config) -> APIRouter:
    router = APIRouter()

    @router.get("/healthz/integrations/wiki/rest/api/user/current")
    async def confluence_user_current(
        response: Response,
        client: AsyncClient = Depends(get_confluence_client),
    ):
        try:
            upstream = await client.get("/wiki/rest/api/user/current")
        except Exception as exc:  # noqa: BLE001
            response.status_code = status.HTTP_502_BAD_GATEWAY
            return {"service": "confluence", "connected": False, "error": str(exc)}
        if upstream.status_code >= 400:
            response.status_code = status.HTTP_502_BAD_GATEWAY
            return {
                "service": "confluence",
                "connected": False,
                "upstream_status": upstream.status_code,
                "upstream_body": upstream.text[:512] if hasattr(upstream, "text") else "",
            }
        return {
            "service": "confluence",
            "connected": True,
            "host": os.environ.get("CONFLUENCE_BASE_URL"),
            "data": upstream.json(),
        }

    return router
