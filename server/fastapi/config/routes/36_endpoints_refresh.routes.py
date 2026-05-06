"""POST /api/runtime-app-config/endpoints/refresh — re-read endpoint.dev.yaml."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException

from app_yaml_fetch_config import list_endpoints, load_config_from_file


def _endpoint_yaml_path() -> Path:
    fixtures = os.environ.get("APP_YAML_FIXTURES_DIR")
    base = Path(fixtures) if fixtures else Path(__file__).resolve().parents[3] / "config"
    return base / "endpoint.dev.yaml"


def mount(_app, _config) -> APIRouter:
    router = APIRouter()

    @router.post("/api/runtime-app-config/endpoints/refresh")
    async def refresh_endpoints():
        path = _endpoint_yaml_path()
        if not path.exists():
            raise HTTPException(status_code=500, detail={"ok": False, "error": f"file missing: {path}"})
        try:
            load_config_from_file(str(path))
            return {
                "ok": True,
                "endpoint_count": len(list_endpoints()),
                "refreshed_at": datetime.now(timezone.utc).isoformat(),
            }
        except Exception as err:  # noqa: BLE001
            raise HTTPException(status_code=500, detail={"ok": False, "error": str(err)}) from err

    return router
