"""GET /healthz/integrations/github/user — proxy of upstream /user."""

from __future__ import annotations

from typing import TYPE_CHECKING

from app_yaml_fetch_config import get_config
from fastapi import APIRouter, Depends, Request, Response, status
from fetch_http_client import AsyncClient

from ._di import get_github_client, get_runtime_template_resolver
from ._provider_config_echo import build_echo

if TYPE_CHECKING:
    from ..lifecycles._runtime_template_resolver import ResolverHandle


def mount(_app, _config) -> APIRouter:
    router = APIRouter()

    @router.get("/healthz/integrations/github/user")
    async def github_user(
        request: Request,
        response: Response,
        client: AsyncClient = Depends(get_github_client),
        resolver: "ResolverHandle" = Depends(get_runtime_template_resolver),
    ):
        cfg = get_config()
        host = (cfg.get("providers") or {}).get("github", {}).get("base_url", "")
        try:
            config_used = await build_echo(
                "github", request, cfg, resolver, trigger="OnRequest"
            )
        except Exception:  # noqa: BLE001
            config_used = None
        try:
            upstream = await client.get("/user")
        except Exception as exc:  # noqa: BLE001
            response.status_code = status.HTTP_502_BAD_GATEWAY
            return {
                "service": "github",
                "connected": False,
                "error": str(exc),
                "config_used": config_used,
            }
        if upstream.status_code >= 400:
            response.status_code = status.HTTP_502_BAD_GATEWAY
            return {
                "service": "github",
                "connected": False,
                "upstream_status": upstream.status_code,
                "upstream_body": upstream.text[:512] if hasattr(upstream, "text") else "",
                "config_used": config_used,
            }
        return {
            "service": "github",
            "connected": True,
            "host": host,
            "data": upstream.json(),
            "config_used": config_used,
        }

    return router
