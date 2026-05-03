"""GET /healthz/app-yaml-file/server/config/{filename} — dynamic introspect.

`applied` is the post-pipeline slice with template expressions
({{app.*}}, {{fn:foo.bar}}, {{request.*}}, {{env.*}}) resolved against
the live request context — what the caller would see at runtime.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import TYPE_CHECKING, Any

from fastapi import APIRouter, Depends, HTTPException, Request

from app_yaml_fetch_config import get_config

from ._app_yaml_filename_guard import assert_safe_basename
from ._di import get_app_yaml_config, get_app_yaml_loader, get_runtime_template_resolver

if TYPE_CHECKING:
    from ..lifecycles._app_yaml_config import ConfigHandle
    from ..lifecycles._app_yaml_loader import LoaderHandle
    from ..lifecycles._runtime_template_resolver import ResolverHandle


def _slice_to_keys(source: Any, keys: list[str]) -> dict[str, Any] | None:
    if not isinstance(source, dict):
        return None
    return {k: source.get(k) for k in keys}


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

    @router.get("/healthz/app-yaml-file/server/config/{filename}")
    async def healthz_app_yaml_file_dynamic(
        filename: str,
        request: Request,
        loader: "LoaderHandle" = Depends(get_app_yaml_loader),
        cfg: "ConfigHandle" = Depends(get_app_yaml_config),
        resolver: "ResolverHandle" = Depends(get_runtime_template_resolver),
    ):
        try:
            safe = assert_safe_basename(filename)
        except ValueError as err:
            raise HTTPException(status_code=400, detail=str(err)) from err

        file_path = str(Path(loader.config_dir) / safe)
        abs_path = os.path.abspath(file_path)

        try:
            loaded = loader.load_files([file_path], missing="skip")
        except Exception as err:  # noqa: BLE001
            raise HTTPException(status_code=500, detail=str(err)) from err

        raw = loaded.get(abs_path)
        if raw is None:
            raise HTTPException(status_code=404, detail=f"file not found: {file_path}")

        keys = list(raw.keys())
        merged = _slice_to_keys(cfg.raw, keys)
        try:
            full_cfg = get_config()
            applied_slice = _slice_to_keys(full_cfg, keys)
            if applied_slice is not None:
                ctx = _build_request_context(request, full_cfg)
                applied = await resolver.resolve_object(applied_slice, ctx)
            else:
                applied = None
        except Exception:  # noqa: BLE001
            applied = None

        return {"ok": True, "file": abs_path, "raw": raw, "merged": merged, "applied": applied}

    return router
