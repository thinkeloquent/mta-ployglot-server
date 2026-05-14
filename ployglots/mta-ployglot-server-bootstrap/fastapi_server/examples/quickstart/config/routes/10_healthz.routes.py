"""Healthz routes for fastapi_server."""

import os

from fastapi import APIRouter


def mount(app, config) -> APIRouter:
    router = APIRouter()

    @router.get("/healthz")
    async def healthz():
        return {
            "status": "ok",
            "service": config.title,
            "profile": config.profile,
            "build_id": os.environ.get("BUILD_ID"),
            "build_version": os.environ.get("BUILD_VERSION"),
        }

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
