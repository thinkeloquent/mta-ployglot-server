"""GET /healthz/integrations/jira/myself — proxy of upstream /rest/api/3/myself."""

from __future__ import annotations

import os

from fastapi import APIRouter, Depends, Response, status
from fetch_http_client import AsyncClient

from ._di import get_jira_client


def mount(_app, _config) -> APIRouter:
    router = APIRouter()

    @router.get("/healthz/integrations/jira/myself")
    async def jira_myself(
        response: Response,
        client: AsyncClient = Depends(get_jira_client),
    ):
        try:
            upstream = await client.get("/rest/api/3/myself")
        except Exception as exc:  # noqa: BLE001
            response.status_code = status.HTTP_502_BAD_GATEWAY
            return {"service": "jira", "connected": False, "error": str(exc)}
        if upstream.status_code >= 400:
            response.status_code = status.HTTP_502_BAD_GATEWAY
            return {
                "service": "jira",
                "connected": False,
                "upstream_status": upstream.status_code,
                "upstream_body": upstream.text[:512] if hasattr(upstream, "text") else "",
            }
        return {
            "service": "jira",
            "connected": True,
            "host": os.environ.get("JIRA_BASE_URL"),
            "data": upstream.json(),
        }

    return router
