"""Lifecycle hooks for fastapi_server."""

import logging

log = logging.getLogger("fastapi_server.lifecycle")


def on_init(app, config):
    log.info("init hook: boot complete (title=%s port=%s)", config.title, config.port)


async def on_startup(app, _config):
    log.info("startup hook: server is ready for traffic")


async def on_shutdown(app, _config):
    log.info("shutdown hook: draining connections")
