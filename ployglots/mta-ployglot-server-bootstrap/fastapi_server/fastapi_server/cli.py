"""Minimal default CLI for fastapi-server.

Boots an empty app — use `examples/quickstart/` as a template for your own config.
"""

from __future__ import annotations

import asyncio
import os

import uvicorn

from fastapi_server.bootstrap import (
    SetupOptions,
    create_fastapi_adapter,
    environment_addon,
    lifecycle_addon,
    route_addon,
    setup,
)


async def _build():
    adapter = create_fastapi_adapter()
    addons = [environment_addon, lifecycle_addon, route_addon]
    config = {
        "title": os.environ.get("SERVICE_TITLE", "fastapi-server"),
        "port": int(os.environ.get("PORT", "8000")),
        "host": os.environ.get("HOST", "0.0.0.0"),
        "paths": {},
    }
    return await setup(adapter, addons, config, SetupOptions(base_dir=os.getcwd()))


def run() -> None:
    app = asyncio.run(_build())
    uvicorn.run(
        app,
        host=os.environ.get("HOST", "0.0.0.0"),
        port=int(os.environ.get("PORT", "8000")),
    )


if __name__ == "__main__":
    run()
