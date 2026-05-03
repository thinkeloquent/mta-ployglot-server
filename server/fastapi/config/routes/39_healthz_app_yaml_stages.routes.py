"""GET /healthz/app-yaml-stage/{stage} — pipeline stage diagnostic accessor."""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING, Any

from fastapi import APIRouter, Depends, HTTPException

from app_yaml_fetch_config import (
    get_config,
    get_endpoint,
    list_endpoints,
    resolve_intent,
)

from ._di import get_app_yaml_config, get_app_yaml_loader

if TYPE_CHECKING:
    from ..lifecycles._app_yaml_config import ConfigHandle
    from ..lifecycles._app_yaml_loader import LoaderHandle

VALID_STAGES = ("raw", "merged", "applied", "derived")
EXTRA_CONFIG_FILES = ("database_schema.yaml", "llm_rag.yml", "vite.yaml")


def _stage_raw(loader: "LoaderHandle") -> dict[str, Any]:
    default_loaded = loader.load_from_config_dir(missing="skip")
    extra_paths = [str(Path(loader.config_dir) / f) for f in EXTRA_CONFIG_FILES]
    extra_loaded = loader.load_files(extra_paths, missing="skip")
    out: dict[str, Any] = {}
    for k, v in default_loaded.items():
        out[k] = v
    for k, v in extra_loaded.items():
        out[k] = v
    return out


def _stage_derived() -> dict[str, Any]:
    keys = list_endpoints()
    endpoints = {k: get_endpoint(k) for k in keys}
    applied = get_config() or {}
    declared = list((applied.get("intent_mapping") or {}).get("mappings", {}).keys())
    intent_resolutions: dict[str, Any] = {}
    for intent in declared:
        try:
            intent_resolutions[intent] = resolve_intent(intent)
        except Exception:  # noqa: BLE001
            intent_resolutions[intent] = None
    return {
        "endpoint_keys": keys,
        "endpoints": endpoints,
        "intent_resolutions": intent_resolutions,
        "default_intent": (applied.get("intent_mapping") or {}).get("default_intent"),
    }


def mount(_app, _config) -> APIRouter:
    router = APIRouter()

    @router.get("/healthz/app-yaml-stage/{stage}")
    async def healthz_app_yaml_stage(
        stage: str,
        loader: "LoaderHandle" = Depends(get_app_yaml_loader),
        cfg: "ConfigHandle" = Depends(get_app_yaml_config),
    ):
        if stage not in VALID_STAGES:
            raise HTTPException(
                status_code=400,
                detail={
                    "ok": False,
                    "error": f"unknown stage: {stage}",
                    "valid_stages": list(VALID_STAGES),
                },
            )
        try:
            if stage == "raw":
                data = _stage_raw(loader)
            elif stage == "merged":
                data = cfg.raw
            elif stage == "applied":
                data = get_config()
            else:
                data = _stage_derived()
        except Exception as err:  # noqa: BLE001
            raise HTTPException(status_code=500, detail=str(err)) from err

        return {"ok": True, "stage": stage, "data": data}

    return router
