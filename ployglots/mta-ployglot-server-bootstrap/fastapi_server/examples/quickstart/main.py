"""FastAPI user-space entry point backed by fastapi_server.bootstrap."""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

import uvicorn

from fastapi_server.bootstrap import (
    create_fastapi_adapter,
    environment_addon,
    lifecycle_addon,
    route_addon,
    setup,
    SetupOptions,
)


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
    return await setup(adapter, addons, config, opts)


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
