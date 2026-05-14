---
name: route-module
scope: fastapi_server
description: Write a *.routes.py module that the built-in route_addon will discover and mount on the FastAPI app.
triggers:
  - "routes file"
  - "mount router"
  - "APIRouter"
  - "route module"
---

# Skill — Route module

## What the loader expects

`route_addon` (priority 30) scans `config.paths.routes/` for files ending in `.routes.py`. It then looks at the module — in order — for:

1. `mount`
2. `router`
3. `default`

The first one it finds determines the shape:

- **Callable** (`mount`/`default`) — called as `fn(app, config)`. Return an `APIRouter` for `app.include_router(...)`; returning `None` means "I mounted myself."
- **Non-callable** (`router` export) — treated as a ready-made `APIRouter` and included as-is.

If none of the three are present, the module is `skipped` and an entry is added to `report.errors` with `step="shape"`.

## Template (recommended)

```python
# config/routes/10_healthz.routes.py
from __future__ import annotations
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
        }

    return router
```

## Alternative: expose a pre-built router

```python
# config/routes/20_metrics.routes.py
from fastapi import APIRouter

router = APIRouter(prefix="/metrics")

@router.get("/")
async def metrics():
    return {"ok": True}
```

This works but you lose access to `config` — prefer `mount(app, config)` unless the router is truly static.

## Rules

1. **Keep `mount` sync.** The FastAPI adapter explicitly rejects awaitables returned from `mount` (async setup belongs in `on_startup`).
2. **Use `APIRouter`** — the adapter calls `app.include_router(result)` and expects that type. Anything else is a no-op.
3. **Read config from the `config` parameter** (`ResolvedBootstrapConfig`), not from `app.state` — keeps routes testable in isolation.
4. **Don't register middleware from a route module.** Middleware belongs in `on_init`.
5. **Prefix filenames for ordering** (`01_`, `10_`, `20_`). The scan uses `sort_by_numeric_prefix`.
6. **Don't call `app.add_event_handler(...)`.** Use `on_startup` / `on_shutdown` lifecycle exports.
7. **Don't block on imports.** The addon imports the module as part of boot — keep it cheap.

## Testing a route module

```python
from fastapi.testclient import TestClient
from fastapi import FastAPI
from my_project.config.routes._10_healthz_routes import mount  # module: 10_healthz.routes.py → 10_healthz_routes when imported


def test_healthz():
    app = FastAPI()
    fake_config = type("C", (), {"title": "t", "profile": "p"})
    app.include_router(mount(app, fake_config))
    r = TestClient(app).get("/healthz")
    assert r.status_code == 200
    assert r.json()["service"] == "t"
```

## Anti-patterns

- Exporting a function that *isn't* called `mount`, `router`, or `default` — it'll be skipped.
- Returning a list/tuple of routers from `mount` — unsupported; return one `APIRouter` or mount inline on `app`.
- Creating DB clients inside `mount` — do it in `on_startup` and read via `app.state` inside endpoints.
