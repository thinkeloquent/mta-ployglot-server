---
name: lifecycle-hook
scope: fastapi_server
description: Write `on_init` / `on_startup` / `on_shutdown` modules that the lifecycle_addon will pick up and run at the right phase.
triggers:
  - "lifecycle hook"
  - "on_startup"
  - "on_shutdown"
  - "on_init"
  - "startup hook"
  - "shutdown hook"
---

# Skill — Author a lifecycle module

## What the loader expects

`lifecycle_addon` scans `config.paths.lifecycles/` for files ending in `.lifecycle.py` and looks for these three names at module top-level:

| Export | Runs when | Errors | Typical use |
| --- | --- | --- | --- |
| `on_init(app, config)`     | **Once**, inside `setup()` before routes see traffic. Sync OR async. | Logged, NOT raised | Decorate `app.state`, mount middleware that needs config |
| `on_startup(app, config)`  | On ASGI `lifespan` startup (first request / uvicorn ready). Usually async. | Logged, NOT raised | Warm pools, open DB connections, register metrics |
| `on_shutdown(app, config)` | On ASGI `lifespan` shutdown (SIGTERM or uvicorn stop). Usually async. | Logged, NOT raised | Drain queues, flush buffers, close connections |

A module can export any subset. If it exports none, the addon counts it as `skipped`.

## Template

```python
# config/lifecycles/20_db.lifecycle.py
from __future__ import annotations
import logging

log = logging.getLogger("my-service.db")


def on_init(app, config):
    app.state.db_dsn = config.extra.get("db_dsn") or "postgres://localhost/app"
    log.info("db dsn resolved: %s", app.state.db_dsn)


async def on_startup(app, _config):
    app.state.db = await _connect(app.state.db_dsn)
    log.info("db pool opened")


async def on_shutdown(app, _config):
    pool = getattr(app.state, "db", None)
    if pool is not None:
        await pool.close()
        log.info("db pool closed")


async def _connect(dsn: str):
    # ... actual pool factory ...
    ...
```

## Rules

1. **Signature is `(server, config)`** — even when you don't use one of them, accept both. Rename the unused one `_server` / `_config` to silence linters.
2. **Sync or async** — both are fine. The orchestrator uses `inspect.isawaitable(result)` to await only when needed.
3. **Never raise as "I don't like this state"** — a lifecycle failure is logged and the server continues. If a startup hook truly must abort boot, raise from `on_init` (runs inside `setup()`), and even then, prefer to validate early in an addon.
4. **Don't register Fastify-style decorators here** — use `on_init` to set `app.state.X` or add middleware via `app.add_middleware(...)`.
5. **Don't do heavy work at module import time.** The lifecycle addon `import`s the module for its hooks, not for side effects.
6. **Use `config`, not the environment.** The `config.extra` dict carries unknown keys from the user's `BootstrapConfig`; read settings from there so tests can inject them.
7. **Ordering** — prefix the filename with `10_`, `20_`, `30_` to guarantee load order. `sort_by_numeric_prefix` is used.
8. **Test each hook standalone** — treat it as a regular function: `await on_startup(fake_app, fake_config)`.

## Anti-patterns

- Importing `fastapi_server.bootstrap.setup` from a lifecycle file (circular / never needed).
- Spawning background tasks without storing the handle on `app.state` (unshutdownable).
- Calling `sys.exit(...)` — log and let the caller decide.
- Relying on import order within the same directory without numeric prefixes.
