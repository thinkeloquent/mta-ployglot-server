"""GET /healthz/integrations/saucelabs/rest/v1/user — proxy of upstream /rest/v1/users/{user}/concurrency."""

from __future__ import annotations

import os
from urllib.parse import quote

from fastapi import APIRouter, Depends, Response, status
from fetch_http_client import AsyncClient

from ._di import get_saucelabs_client


def mount(_app, _config) -> APIRouter:
    router = APIRouter()

    @router.get("/healthz/integrations/saucelabs/rest/v1/user")
    async def saucelabs_concurrency(
        response: Response,
        client: AsyncClient = Depends(get_saucelabs_client),
    ):
        user = os.environ.get("SAUCE_USERNAME")
        if not user:
            response.status_code = status.HTTP_502_BAD_GATEWAY
            return {"service": "saucelabs", "connected": False, "error": "Missing env SAUCE_USERNAME"}
        try:
            upstream = await client.get(
                f"/rest/v1/users/{quote(user, safe='')}/concurrency"
            )
        except Exception as exc:  # noqa: BLE001
            response.status_code = status.HTTP_502_BAD_GATEWAY
            return {"service": "saucelabs", "connected": False, "error": str(exc)}
        if upstream.status_code >= 400:
            response.status_code = status.HTTP_502_BAD_GATEWAY
            return {
                "service": "saucelabs",
                "connected": False,
                "upstream_status": upstream.status_code,
                "upstream_body": upstream.text[:512] if hasattr(upstream, "text") else "",
            }
        data = upstream.json()
        if not isinstance(data, dict):
            data = {}
        conc = data.get("concurrency", {}) if isinstance(data, dict) else {}
        org = (conc.get("organization") or {}).get("allowed", {}) or {}
        team = (conc.get("team") or {}).get("allowed", {}) or {}
        return {
            "service": "saucelabs",
            "connected": True,
            "host": os.environ.get("SAUCELABS_BASE_URL", "https://api.us-west-1.saucelabs.com"),
            "user": user,
            "org_vms": org.get("vms"),
            "team_vms": team.get("vms"),
        }

    return router
