"""GET /healthz/integrations/saucelabs/rest/v1/user — proxy of upstream /rest/v1/users/{user}/concurrency."""

from __future__ import annotations

from typing import TYPE_CHECKING
from urllib.parse import quote

from app_yaml_fetch_config import get_config
from fastapi import APIRouter, Depends, Request, Response, status
from fetch_http_client import AsyncClient

from ._di import get_runtime_template_resolver, get_saucelabs_client
from ._provider_config_echo import build_echo

if TYPE_CHECKING:
    from ..lifecycles._runtime_template_resolver import ResolverHandle


def mount(_app, _config) -> APIRouter:
    router = APIRouter()

    @router.get("/healthz/integrations/saucelabs/rest/v1/user")
    async def saucelabs_concurrency(
        request: Request,
        response: Response,
        client: AsyncClient = Depends(get_saucelabs_client),
        resolver: "ResolverHandle" = Depends(get_runtime_template_resolver),
    ):
        cfg = get_config()
        slice_ = (cfg.get("providers") or {}).get("saucelabs", {})
        host = slice_.get("base_url", "")
        user = slice_.get("username")
        try:
            config_used = await build_echo(
                "saucelabs", request, cfg, resolver, trigger="OnRequest"
            )
        except Exception:  # noqa: BLE001
            config_used = None
        if not user:
            response.status_code = status.HTTP_502_BAD_GATEWAY
            return {
                "service": "saucelabs",
                "connected": False,
                "error": "Missing cfg.providers.saucelabs.username (set SAUCE_USERNAME)",
                "config_used": config_used,
            }
        try:
            upstream = await client.get(
                f"/rest/v1/users/{quote(user, safe='')}/concurrency"
            )
        except Exception as exc:  # noqa: BLE001
            response.status_code = status.HTTP_502_BAD_GATEWAY
            return {
                "service": "saucelabs",
                "connected": False,
                "error": str(exc),
                "config_used": config_used,
            }
        if upstream.status_code >= 400:
            response.status_code = status.HTTP_502_BAD_GATEWAY
            return {
                "service": "saucelabs",
                "connected": False,
                "upstream_status": upstream.status_code,
                "upstream_body": upstream.text[:512] if hasattr(upstream, "text") else "",
                "config_used": config_used,
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
            "host": host,
            "user": user,
            "org_vms": org.get("vms"),
            "team_vms": team.get("vms"),
            "config_used": config_used,
        }

    return router
