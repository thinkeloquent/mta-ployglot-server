"""GET /healthz/integrations/wiki/rest/api/user/current — proxy of upstream /wiki/rest/api/user/current."""

from __future__ import annotations

from typing import TYPE_CHECKING

from app_yaml_fetch_config import get_config
from fastapi import APIRouter, Depends, Request, Response, status
from fetch_http_client import AsyncClient

from ._di import get_confluence_client, get_runtime_template_resolver
from ._provider_config_echo import build_echo

if TYPE_CHECKING:
    from ..lifecycles._runtime_template_resolver import ResolverHandle


def mount(_app, _config) -> APIRouter:
    router = APIRouter()

    @router.get("/healthz/integrations/wiki/rest/api/user/current")
    async def confluence_user_current(
        request: Request,
        response: Response,
        client: AsyncClient = Depends(get_confluence_client),
        resolver: "ResolverHandle" = Depends(get_runtime_template_resolver),
    ):
        cfg = get_config()
        host = (cfg.get("providers") or {}).get("confluence", {}).get("base_url", "")
        try:
            config_used = await build_echo(
                "confluence", request, cfg, resolver, trigger="OnRequest"
            )
        except Exception:  # noqa: BLE001
            config_used = None
        try:
            upstream = await client.get("/wiki/rest/api/user/current")
        except Exception as exc:  # noqa: BLE001
            response.status_code = status.HTTP_502_BAD_GATEWAY
            return {
                "service": "confluence",
                "connected": False,
                "error": str(exc),
                "config_used": config_used,
            }
        if upstream.status_code >= 400:
            response.status_code = status.HTTP_502_BAD_GATEWAY
            return {
                "service": "confluence",
                "connected": False,
                "upstream_status": upstream.status_code,
                "upstream_body": upstream.text[:512] if hasattr(upstream, "text") else "",
                "config_used": config_used,
            }
        return {
            "service": "confluence",
            "connected": True,
            "host": host,
            "data": upstream.json(),
            "config_used": config_used,
        }

    return router
