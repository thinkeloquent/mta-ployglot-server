"""FastAPI user-space entry point backed by fastapi_server.bootstrap."""

from __future__ import annotations

import asyncio
import json
import os
import time
from pathlib import Path

import uvicorn
from fastapi import Request

from fastapi_server.bootstrap import (
    create_fastapi_adapter,
    environment_addon,
    lifecycle_addon,
    route_addon,
    setup,
    SetupOptions,
)
from print_routes_fastapi import print_routes


PROJECT_ROOT = Path(__file__).resolve().parent


def build_config() -> dict:
    return {
        "title": "fastapi_server",
        "port": int(os.environ.get("PORT", "52000")),
        "host": os.environ.get("HOST", "0.0.0.0"),
        "profile": os.environ.get("APP_ENV", "local"),
        "logger": {"level": os.environ.get("LOG_LEVEL", "info")},
        "paths": {
            "environment": ["config/environment"],
            "lifecycles": ["config/lifecycles"],
            "routes": ["config/routes"],
        },
        "initial_state": {
            "build_id": os.environ.get("BUILD_ID", "dev"),
            "build_version": os.environ.get("BUILD_VERSION", "0.0.0"),
        },
    }


async def build_app():
    adapter = create_fastapi_adapter()
    addons = [environment_addon, lifecycle_addon, route_addon]
    config = build_config()
    opts = SetupOptions(base_dir=str(PROJECT_ROOT))
    app = await setup(adapter, addons, config, opts)
    print_routes(app)
    _install_log_middleware(app)
    return app


def _install_log_middleware(app) -> None:
    log_dir = os.environ.get("LOG_DIR")
    if not log_dir:
        return
    log_path = Path(log_dir)
    log_path.mkdir(parents=True, exist_ok=True)
    req_log = log_path / "fastapi.request.log"
    err_log = log_path / "fastapi.error.log"

    def _append(path: Path, payload: dict) -> None:
        try:
            with path.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(payload) + "\n")
        except OSError:
            pass

    @app.middleware("http")
    async def _log_request(request: Request, call_next):
        start = time.monotonic()
        ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        try:
            response = await call_next(request)
        except Exception as exc:  # noqa: BLE001
            _append(err_log, {
                "t": ts,
                "method": request.method,
                "path": request.url.path,
                "rt_ms": round((time.monotonic() - start) * 1000.0, 2),
                "err": repr(exc),
            })
            raise
        _append(req_log, {
            "t": ts,
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "rt_ms": round((time.monotonic() - start) * 1000.0, 2),
        })
        return response


def cli_main() -> None:
    config = build_config()
    app = asyncio.run(build_app())
    uvicorn.run(
        app,
        host=config["host"],
        port=config["port"],
        log_level=str(config["logger"]["level"]).lower(),
    )


if __name__ == "__main__":
    cli_main()
