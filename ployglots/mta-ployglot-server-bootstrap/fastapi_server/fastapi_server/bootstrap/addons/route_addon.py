from __future__ import annotations

from fastapi_server.bootstrap.contract import create_loader_report
from fastapi_server.bootstrap.registry.registry import Addon
from fastapi_server.bootstrap.registry.loader_logger import create_loader_logger
from fastapi_server.bootstrap.addons._discover import discover_files, import_file

_SUFFIXES = (".routes.py",)


def _run(server, config, ctx):
    report = create_loader_report("route")
    log = create_loader_logger("route", ctx.logger, report)
    adapter = ctx.get_adapter()

    for d in config.paths.routes:
        try:
            result = discover_files(d, _SUFFIXES)
        except Exception as err:  # noqa: BLE001
            log.failed("discover", d, err)
            continue
        log.scan_dir(d, len(result.matched))
        report.discovered += len(result.matched)

        for file in result.matched:
            try:
                mod = import_file(file, module_name_prefix="polyglot_routes")
                report.imported += 1
                log.loaded(file)
            except Exception as err:  # noqa: BLE001
                log.failed("import", file, err)
                continue

            fn = getattr(mod, "mount", None) or getattr(mod, "router", None) or getattr(mod, "default", None)
            if fn is None:
                report.skipped += 1
                log.failed("shape", file, "module exposes no 'mount', 'router' or 'default'")
                continue

            try:
                if callable(fn):
                    adapter.register_routes(server, fn)
                else:
                    # Assume it's already an APIRouter-like object
                    adapter.register_routes(server, lambda _s, _c, _fn=fn: _fn)
                report.registered += 1
                log.registered(file)
            except Exception as err:  # noqa: BLE001
                log.failed("register", file, err)

    return report


route_addon = Addon(name="route", priority=30, run=_run)
