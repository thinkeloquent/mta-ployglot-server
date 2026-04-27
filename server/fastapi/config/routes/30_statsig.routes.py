"""GET /healthz/integrations/statsig/gates — proxy of upstream /console/v1/gates."""

from __future__ import annotations

import os

from fastapi import APIRouter, Depends, Response, status
from fetch_http_client import AsyncClient

from ._di import get_statsig_client


def mount(_app, _config) -> APIRouter:
    router = APIRouter()

    @router.get("/healthz/integrations/statsig/gates")
    async def statsig_feature_gates(
        response: Response,
        client: AsyncClient = Depends(get_statsig_client),
    ):
        try:
            upstream = await client.get("/gates")
        except Exception as exc:  # noqa: BLE001
            response.status_code = status.HTTP_502_BAD_GATEWAY
            return {"service": "statsig", "connected": False, "error": str(exc)}
        if upstream.status_code >= 400:
            response.status_code = status.HTTP_502_BAD_GATEWAY
            return {
                "service": "statsig",
                "connected": False,
                "upstream_status": upstream.status_code,
                "upstream_body": upstream.text[:512] if hasattr(upstream, "text") else "",
            }
        body = upstream.json()
        rows = (body.get("data") or [])[:5] if isinstance(body, dict) else []
        gates = [
            {"id": r.get("id"), "name": r.get("name"), "isEnabled": r.get("isEnabled")}
            for r in rows
        ]
        return {
            "service": "statsig",
            "connected": True,
            "host": os.environ.get("STATSIG_BASE_URL", "https://statsigapi.net/console/v1"),
            "count": len(gates),
            "gates": gates,
        }

    return router
