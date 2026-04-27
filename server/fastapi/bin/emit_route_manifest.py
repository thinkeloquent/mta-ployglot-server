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


def main():
    if not ROUTES_DIR.is_dir():
        print(f"emit_route_manifest: cannot read {ROUTES_DIR}", file=sys.stderr)
        sys.exit(1)

    files = sorted(p for p in ROUTES_DIR.glob("[0-9]*_*.routes.py"))
    for path in files:
        before = len(collected)
        collector = RouteCollector(path.name)
        try:
            spec = importlib.util.spec_from_file_location(path.stem, path)
            mod = importlib.util.module_from_spec(spec)
            sys.modules[path.stem] = mod
            spec.loader.exec_module(mod)

            # Dispatch: try mount(), router, or default
            fn = getattr(mod, "mount", None) or getattr(mod, "default", None)
            if callable(fn):
                result = fn(collector, {})
                # If mount returned an APIRouter, walk its routes
                if result is not None and hasattr(result, "routes"):
                    for r in result.routes:
                        rec = getattr(r, "_rec", None)
                        if rec:
                            collected.append(rec)
            else:
                router = getattr(mod, "router", None)
                if router is not None and hasattr(router, "routes"):
                    for r in router.routes:
                        rec = getattr(r, "_rec", None)
                        if rec:
                            collected.append(rec)
                else:
                    print(f"WARN: {path.name}: no mount/router/default", file=sys.stderr)
        except Exception as e:  # noqa: BLE001
            print(f"WARN: {path.name}: {e}", file=sys.stderr)

        for r in collected[before:]:
            print(json.dumps({"twin": "fastapi", "method": r["method"], "path": r["path"], "file": str(path), "source": r["source"]}))


if __name__ == "__main__":
    main()
