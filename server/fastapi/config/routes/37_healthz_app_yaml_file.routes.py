"""GET /healthz/app-yaml-file/server/config/endpoint.dev.yaml.

Returns the post-pipeline view of the global config with template
expressions ({{app.*}}, {{fn:foo.bar}}, {{request.*}}, {{env.*}})
resolved against a per-request context. Boot pipeline (slots 25 -> 27
-> 28 -> 29) produced the merged dict with templates baked in; this
route walks that dict once more with the resolver so callers see the
fully-computed values they would get at runtime.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from fastapi import APIRouter, Depends, HTTPException, Request

from app_yaml_fetch_config import get_config

from ._di import get_runtime_template_resolver

if TYPE_CHECKING:
    from ..lifecycles._runtime_template_resolver import ResolverHandle


def _build_request_context(req: Request, cfg: dict[str, Any]) -> dict[str, Any]:
    return {
        "app": cfg.get("app") if isinstance(cfg, dict) else None,
        "request": {
            "headers": {k.lower(): v for k, v in req.headers.items()},
            "method": req.method,
            "path": req.url.path,
        },
    }


def mount(_app, _config) -> APIRouter:
    router = APIRouter()

    @router.get("/healthz/app-yaml-file/server/config/endpoint.dev.yaml")
    async def healthz_app_yaml_file(
        request: Request,
        resolver: "ResolverHandle" = Depends(get_runtime_template_resolver),
    ):
        try:
            cfg = get_config()
            ctx = _build_request_context(request, cfg)
            resolved = await resolver.resolve_object(cfg, ctx)
            return {"ok": True, "data": resolved}
        except Exception as err:  # noqa: BLE001
            raise HTTPException(status_code=500, detail=str(err)) from err

    return router
