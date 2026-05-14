"""01_app_metadata — STARTUP. Returns {name, version, started_at}."""
from __future__ import annotations
import os
from datetime import datetime, timezone

_started_at = datetime.now(timezone.utc).isoformat()


def compute(_ctx, _path=None):
    return {
        "name": os.environ.get("APP_NAME", "demo"),
        "version": os.environ.get("APP_VERSION", "0.0.0"),
        "started_at": _started_at,
    }


scope = "STARTUP"
