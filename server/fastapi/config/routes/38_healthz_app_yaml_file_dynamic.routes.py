"""GET /healthz/app-yaml-file/server/config/{filename} — dynamic introspect."""

from __future__ import annotations

import os
from pathlib import Path
from typing import TYPE_CHECKING, Any

from fastapi import APIRouter, Depends, HTTPException

from app_yaml_fetch_config import get_config

from ._app_yaml_filename_guard import assert_safe_basename
from ._di import get_app_yaml_config, get_app_yaml_loader

if TYPE_CHECKING:
    from ..lifecycles._app_yaml_config import ConfigHandle
    from ..lifecycles._app_yaml_loader import LoaderHandle


def _slice_to_keys(source: Any, keys: list[str]) -> dict[str, Any] | None:
    if not isinstance(source, dict):
        return None
    return {k: source.get(k) for k in keys}


def mount(_app, _config) -> APIRouter:
    router = APIRouter()

    @router.get("/healthz/app-yaml-file/server/config/{filename}")
    async def healthz_app_yaml_file_dynamic(
        filename: str,
        loader: "LoaderHandle" = Depends(get_app_yaml_loader),
        cfg: "ConfigHandle" = Depends(get_app_yaml_config),
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
            applied = _slice_to_keys(get_config(), keys)
        except Exception:  # noqa: BLE001
            applied = None

        return {"ok": True, "file": abs_path, "raw": raw, "merged": merged, "applied": applied}

    return router
