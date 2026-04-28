"""Construct a LoaderHandle on app.state for Depends() injection."""

from __future__ import annotations

import logging
import os
from pathlib import Path

from ._app_yaml_loader import LoaderHandle

log = logging.getLogger("fastapi_server.app_yaml_loader")


def _default_config_dir() -> str:
    # Resolution order: APP_YAML_FIXTURES_DIR env (parity with the fastify
    # twin; set by Makefile.devmode) → walk up from this file to server/config/.
    # .../server/fastapi/config/lifecycles/25_*.py → server/config/
    override = os.environ.get("APP_YAML_FIXTURES_DIR")
    if override:
        return override
    return str(Path(__file__).resolve().parents[3] / "config")


def on_init(app, _config) -> None:
    app.state.app_yaml_loader = None


async def on_startup(app, _config) -> None:
    config_dir = _default_config_dir()
    app.state.app_yaml_loader = LoaderHandle(config_dir=config_dir)
    log.info("app_yaml_loader initialized: config_dir=%s", config_dir)


async def on_shutdown(app, _config) -> None:
    app.state.app_yaml_loader = None
