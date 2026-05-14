#!/usr/bin/env python3
"""emit_route_manifest.py — load every server/fastapi/config/routes/30_*.routes.py
in a sandbox and dump the canonical route inventory as JSON-lines on stdout.

Mirror of server/fastify/bin/emit-route-manifest.mjs. Used by twin-diff to detect
dynamically-registered routes the static regex misses.
"""
import importlib.util
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROUTES_DIR = HERE.parent / "config" / "routes"

collected = []


class RouteCollector:
    """Minimal mock that captures route registrations from FastAPI addons.

    Supports:
      - decorator style:  @router.get("/path") / @app.get(...)
      - explicit:         router.add_api_route("/path", handler, methods=["GET"])
      - returning APIRouter: caller iterates router.routes
    """

    def __init__(self, source):
        self.source = source
        self.routes = []  # mimic APIRouter.routes shape (list of Route-likes)

    def _add(self, method, path):
        rec = {"source": self.source, "method": method.upper(), "path": path}
        collected.append(rec)
        self.routes.append(_FakeRoute(rec))

    def _verb(self, method):
        def deco(path, **_kw):
            self._add(method, path)
            def wrap(fn):
                return fn
            return wrap
        return deco

    def __getattr__(self, name):
        if name in ("get", "post", "put", "delete", "patch", "head", "options"):
            return self._verb(name)
        # Anything else is a no-op to avoid AttributeError crashes
        def noop(*_a, **_kw):
            return None
        return noop

    def add_api_route(self, path, _endpoint, methods=None, **_kw):
        for m in (methods or ["GET"]):
            self._add(m, path)

    def include_router(self, router, prefix="", **_kw):
        if hasattr(router, "routes"):
            for r in router.routes:
                rec = getattr(r, "_rec", None)
                if rec:
                    self._add(rec["method"], prefix + rec["path"])


class _FakeRoute:
    def __init__(self, rec):
        self._rec = rec
        self.path = rec["path"]
        self.methods = {rec["method"]}


def _absorb_route(r, source):
    """Append a route record from either a `_FakeRoute` (collector path)
    or a real Starlette/FastAPI Route/APIRoute (mount() returning a real
    APIRouter). Real routes carry `.path` plus a `.methods` set; we emit
    one record per HTTP verb (skipping HEAD which Starlette pairs with
    GET automatically)."""
    rec = getattr(r, "_rec", None)
    if rec:
        collected.append(rec)
        return
    path = getattr(r, "path", None)
    methods = getattr(r, "methods", None)
    if not path or not methods:
        return
    for m in methods:
        if m == "HEAD":
            continue
        collected.append({"source": source, "method": m.upper(), "path": path})


def _register_routes_pkg():
    """Synthesize an in-memory `_routes_pkg` package whose __path__ points
    at server/fastapi/config/routes/, so route files loaded under this
    package name can resolve their `from ._di import ...` style imports.
    """
    import types
    pkg = types.ModuleType("_routes_pkg")
    pkg.__path__ = [str(ROUTES_DIR)]
    sys.modules["_routes_pkg"] = pkg


def main():
    if not ROUTES_DIR.is_dir():
        print(f"emit_route_manifest: cannot read {ROUTES_DIR}", file=sys.stderr)
        sys.exit(1)

    _register_routes_pkg()

    files = sorted(p for p in ROUTES_DIR.glob("[0-9]*_*.routes.py"))
    for path in files:
        before = len(collected)
        collector = RouteCollector(path.name)
        # Build a valid Python module name under the synthetic _routes_pkg
        # parent so relative imports (`from ._di import ...`) resolve.
        # Embedded dots in the stem (e.g. `30_figma.routes`) become `_` and
        # we prefix `_route_` so Python doesn't read the leading digit as a
        # dotted-package boundary.
        leaf = "_route_" + path.stem.replace(".", "_")
        mod_name = f"_routes_pkg.{leaf}"
        try:
            spec = importlib.util.spec_from_file_location(mod_name, path)
            mod = importlib.util.module_from_spec(spec)
            sys.modules[mod_name] = mod
            spec.loader.exec_module(mod)

            # Dispatch: try mount(), router, or default
            fn = getattr(mod, "mount", None) or getattr(mod, "default", None)
            if callable(fn):
                result = fn(collector, {})
                # If mount returned an APIRouter (real or fake), walk its routes
                if result is not None and hasattr(result, "routes"):
                    for r in result.routes:
                        _absorb_route(r, path.name)
            else:
                router = getattr(mod, "router", None)
                if router is not None and hasattr(router, "routes"):
                    for r in router.routes:
                        _absorb_route(r, path.name)
                else:
                    print(f"WARN: {path.name}: no mount/router/default", file=sys.stderr)
        except Exception as e:  # noqa: BLE001
            print(f"WARN: {path.name}: {e}", file=sys.stderr)

        for r in collected[before:]:
            print(json.dumps({"twin": "fastapi", "method": r["method"], "path": r["path"], "file": str(path), "source": r["source"]}))


if __name__ == "__main__":
    main()
