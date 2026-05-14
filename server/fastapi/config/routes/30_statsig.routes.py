"""GET /healthz/integrations/statsig/gates — proxy of upstream /console/v1/gates."""

from __future__ import annotations

from typing import TYPE_CHECKING

from app_yaml_fetch_config import get_config
from fastapi import APIRouter, Depends, Request, Response, status
from fetch_http_client import AsyncClient

from ._di import get_runtime_template_resolver, get_statsig_client
from ._provider_config_echo import build_echo

if TYPE_CHECKING:
    from ..lifecycles._runtime_template_resolver import ResolverHandle


def mount(_app, _config) -> APIRouter:
    router = APIRouter()

    @router.get("/healthz/integrations/statsig/gates")
    async def statsig_feature_gates(
        request: Request,
        response: Response,
        client: AsyncClient = Depends(get_statsig_client),
        resolver: "ResolverHandle" = Depends(get_runtime_template_resolver),
    ):
        cfg = get_config()
        host = (cfg.get("providers") or {}).get("statsig", {}).get("base_url", "")
        try:
            config_used = await build_echo(
                "statsig", request, cfg, resolver, trigger="OnRequest"
            )
        except Exception:  # noqa: BLE001
            config_used = None
        try:
            upstream = await client.get("/gates")
        except Exception as exc:  # noqa: BLE001
            response.status_code = status.HTTP_502_BAD_GATEWAY
            return {
                "service": "statsig",
                "connected": False,
                "error": str(exc),
                "config_used": config_used,
            }
        if upstream.status_code >= 400:
            response.status_code = status.HTTP_502_BAD_GATEWAY
            return {
                "service": "statsig",
                "connected": False,
                "upstream_status": upstream.status_code,
                "upstream_body": upstream.text[:512] if hasattr(upstream, "text") else "",
                "config_used": config_used,
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
            "host": host,
            "count": len(gates),
            "gates": gates,
            "config_used": config_used,
        }

    return router
