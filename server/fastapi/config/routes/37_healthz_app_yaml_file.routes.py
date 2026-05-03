"""GET /healthz/app-yaml-file/server/config/endpoint.dev.yaml.

Returns the post-pipeline (merge + overwrite + compute) view of
endpoint.dev.yaml as the fetch SDK has it loaded right now. Boot
pipeline (slots 25 -> 27 -> 28 -> 29) already produced this state via
load_config(merged); re-doing the work here would just diverge.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app_yaml_fetch_config import get_config


def mount(_app, _config) -> APIRouter:
    router = APIRouter()

    @router.get("/healthz/app-yaml-file/server/config/endpoint.dev.yaml")
    async def healthz_app_yaml_file():
        try:
            return {"ok": True, "data": get_config()}
        except Exception as err:  # noqa: BLE001
            raise HTTPException(status_code=500, detail=str(err)) from err

    return router
