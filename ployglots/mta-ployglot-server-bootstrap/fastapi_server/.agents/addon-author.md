---
name: addon-author
scope: fastapi_server
description: Scaffold a new Python addon that plugs into the fastapi_server bootstrap pipeline — correct signature, failure isolation, and LoaderReport shape.
triggers:
  - "write an addon"
  - "new bootstrap addon"
  - "custom loader"
  - "extend the pipeline"
---

# Skill — Author a Python addon

## Pattern

```python
# fastapi_server/bootstrap/addons/my_addon.py
from __future__ import annotations

from fastapi_server.bootstrap.contract import create_loader_report, report_error
from fastapi_server.bootstrap.registry.registry import Addon


def _run(server, config, ctx):
    """run(server, config, ctx) -> LoaderReport. MUST NOT raise."""
    report = create_loader_report("my-addon")

    try:
        # 1. discover: file scan, external call, whatever
        # 2. validate: cheap structural checks
        # 3. import / register: mutate the server via ctx.get_adapter() or
        #    register hooks via ctx.register_{init,startup,shutdown}_hook(fn)
        report.discovered = 0
        report.registered = 0
    except Exception as err:  # noqa: BLE001
        report_error(report, "run", err)

    return report


my_addon = Addon(name="my-addon", priority=40, run=_run)
```

## Checklist before you ship it

- [ ] `name` is unique and matches the filename stem (kebab-case allowed in the name, snake_case in the file).
- [ ] `priority` is a sparse integer that doesn't collide with `10/20/30` (environment/lifecycle/route). Use 15, 25, 35, 40+ and document why.
- [ ] `run` catches all exceptions internally — it MUST NOT leak out. The registry fallback is a safety net, not a design.
- [ ] Every branch ends with an updated counter (`discovered`, `imported`, `skipped`, `registered`) or a `report_error(...)` entry.
- [ ] `report.errors[].step` is one of: `"discover" | "import" | "shape" | "register" | "run"`. Invent a new verb only if truly needed.
- [ ] You call `ctx.logger.debug/info/warn/error` — never `print`.
- [ ] You read paths from `config.paths.<key>` — never re-resolve or re-join `base_dir`.
- [ ] If your addon walks a directory, use `fastapi_server.bootstrap.addons._discover.find_matching_files` + `sort_by_numeric_prefix` for deterministic ordering.
- [ ] If `run` needs to be async, just `async def _run(...)`. The registry awaits it correctly.
- [ ] Export via `fastapi_server/bootstrap/addons/__init__.py` **only** if the addon is meant to be public.
- [ ] Add a test under `tests/` asserting: (a) returns a `LoaderReport`, (b) increments the right counters, (c) a raised exception in the body lands in `report.errors`.

## Anti-patterns

- Raising out of `run` (breaks the pipeline contract; registry will overwrite your report).
- Building a report dict by hand (`{"name": ..., "discovered": 0, ...}`) — use `create_loader_report`.
- Writing to `os.environ` in `run` (that's what `environment_addon` is for).
- Using priorities like `0`, `100`, `1000` — leaves no room between addons.
- Calling `asyncio.run(...)` inside `run` — the orchestrator already owns the loop.
