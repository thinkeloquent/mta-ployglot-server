"""Construct a LoaderHandle on app.state for Depends() injection."""

from __future__ import annotations

import logging
from pathlib import Path

from ._app_yaml_loader import LoaderHandle

log = logging.getLogger("fastapi_server.app_yaml_loader")


def _default_config_dir() -> str:
    return str(Path(__file__).resolve().parent.parent / "app-yaml")


def on_init(app, _config) -> None:
    app.state.app_yaml_loader = None


async def on_startup(app, _config) -> None:
    config_dir = _default_config_dir()
    app.state.app_yaml_loader = LoaderHandle(config_dir=config_dir)
    log.info("app_yaml_loader initialized: config_dir=%s", config_dir)


async def on_shutdown(app, _config) -> None:
    app.state.app_yaml_loader = None
