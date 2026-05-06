"""Slot 24 — discover server/computed_functions/*.compute.py and register into a
ComputeRegistry placed at app.state.compute_registry. Slot 26 reads it.

Multi-root, signature/scope validation, structured ledger — see fastify twin
24_compute_functions.lifecycle.mjs for the full contract.
"""
from __future__ import annotations

import importlib.util
import logging
import os
import re
from pathlib import Path
from typing import Any

from runtime_template_resolver import ComputeRegistry, ComputeScope

log = logging.getLogger("fastapi_server.compute_functions")

_VALID_SCOPES = {"STARTUP", "REQUEST"}
_NAME_RE = re.compile(r"^\d+_")


def _fallback_root() -> Path:
    fixtures = os.environ.get("APP_YAML_FIXTURES_DIR")
    if fixtures:
        return Path(fixtures).resolve().parent / "computed_functions"
    return Path(__file__).resolve().parents[3] / "computed_functions"


def _pick_roots() -> list[Path]:
    env = os.environ.get("COMPUTE_FUNCTIONS_DIRS")
    if env:
        return [Path(p) for p in env.split(":") if p]
    return [_fallback_root()]


def _name_from_filename(p: Path) -> str:
    return _NAME_RE.sub("", p.name).removesuffix(".compute.py")


def _load_module(path: Path):
    spec = importlib.util.spec_from_file_location(path.stem, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def on_init(app, _config) -> None:
    app.state.compute_registry = None
    app.state.compute_registry_ledger = None


async def on_startup(app, _config) -> None:
    ledger: dict[str, Any] = {
        "event": "compute_functions_registered",
        "count": 0,
        "roots": [],
        "registered": [],
        "skipped": [],
        "collisions": [],
    }
    registry = ComputeRegistry()
    seen: dict[str, str] = {}

    for root in _pick_roots():
        if not root.is_dir():
            log.warning("compute_root_missing path=%s", root)
            continue
        ledger["roots"].append(str(root))
        for file in sorted(root.glob("*.compute.py")):
            name = _name_from_filename(file)
            try:
                mod = _load_module(file)
            except Exception as err:  # noqa: BLE001
                ledger["skipped"].append({"file": str(file), "reason": f"import failed: {err}"})
                continue
            fn = getattr(mod, "compute", None)
            if not callable(fn):
                ledger["skipped"].append({"file": str(file), "reason": f"compute() not callable (got {type(fn).__name__})"})
                continue
            scope = getattr(mod, "scope", None)
            if scope is None:
                log.info("compute_function_scope_default file=%s default=REQUEST", file)
                scope = "REQUEST"
            elif scope not in _VALID_SCOPES:
                ledger["skipped"].append({"file": str(file), "reason": f"invalid scope '{scope}' (expected STARTUP|REQUEST)"})
                continue
            if name in seen:
                ledger["collisions"].append({"name": name, "previous_source": seen[name], "new_source": str(file)})
                log.warning("compute_function_collision name=%s previous=%s new=%s", name, seen[name], file)
            seen[name] = str(file)
            cs = ComputeScope.STARTUP if scope == "STARTUP" else ComputeScope.REQUEST
            registry.register(name, fn, cs)
            ledger["registered"] = [e for e in ledger["registered"] if e["name"] != name]
            ledger["registered"].append({"name": name, "scope": scope, "source": str(file)})

    ledger["count"] = len(ledger["registered"])

    if ledger["count"] == 0 and os.environ.get("COMPUTE_FUNCTIONS_REQUIRE_AT_LEAST_ONE") == "true":
        raise RuntimeError("compute_functions: zero functions registered and COMPUTE_FUNCTIONS_REQUIRE_AT_LEAST_ONE=true")

    app.state.compute_registry = registry
    app.state.compute_registry_ledger = ledger
    log.info("compute-functions registered: %d (%s)", ledger["count"], ", ".join(f"{e['name']} ({e['scope']})" for e in ledger["registered"]))


async def on_shutdown(app, _config) -> None:
    app.state.compute_registry = None
    app.state.compute_registry_ledger = None
