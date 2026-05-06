"""Health routes for fastapi_server. /health and /healthz are aliases."""

import os

from fastapi import APIRouter


def _healthz_payload(config):
    return {
        "status": "ok",
        "service": config.title,
        "profile": config.profile,
        "build_id": os.environ.get("BUILD_ID"),
        "build_version": os.environ.get("BUILD_VERSION"),
    }


def mount(app, config) -> APIRouter:
    router = APIRouter()

    @router.get("/healthz")
    async def healthz():
        return _healthz_payload(config)

    @router.get("/health")
    async def health():
        return _healthz_payload(config)

    @router.get("/_reports")
    async def reports():
        return {
            name: {
                "name": r.name,
                "discovered": r.discovered,
                "imported": r.imported,
                "registered": r.registered,
                "skipped": r.skipped,
                "errors": [e.__dict__ for e in r.errors],
                "details": r.details,
            }
            for name, r in getattr(app.state, "_loader_reports", {}).items()
        }

    return router
