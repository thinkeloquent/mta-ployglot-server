"""GET /healthz/app-yaml/{intent} — chained app-yaml compose smoke endpoint."""

from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import APIRouter, Depends, HTTPException

from ._di import get_app_yaml_fetch_config

# Type-only — see _di.py for the cross-dir relative-import rationale.
if TYPE_CHECKING:
    from ..lifecycles._app_yaml_fetch_config import FetchConfigHandle


def mount(_app, _config) -> APIRouter:
    router = APIRouter()

    @router.get("/healthz/app-yaml/{intent}")
    async def healthz_app_yaml(
        intent: str,
        handle: FetchConfigHandle = Depends(get_app_yaml_fetch_config),
    ):
        try:
            data = handle.get_fetch_config(intent, {})
        except Exception as err:  # noqa: BLE001
            raise HTTPException(status_code=404, detail=str(err)) from err
        return {"ok": True, "data": data}

    return router
