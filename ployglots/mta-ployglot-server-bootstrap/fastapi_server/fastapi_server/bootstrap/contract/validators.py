from __future__ import annotations

import os
import re
from typing import Any, Dict, List, Optional

from fastapi_server.bootstrap.contract.types import (
    BootstrapConfig,
    LoaderReport,
    LoaderReportError,
    ResolvedBootstrapConfig,
    ResolvedPaths,
    StringOrArray,
)

_PATH_KEYS = ("environment", "lifecycles", "routes", "apps")
_VALID_LOG_LEVELS = {"trace", "debug", "info", "warn", "warning", "error", "fatal", "silent", "critical"}


class BootstrapConfigError(ValueError):
    """Raised when a BootstrapConfig fails validation."""


def validate_bootstrap_config(config: Any) -> Dict[str, Any]:
    if not isinstance(config, dict):
        if hasattr(config, "__dict__"):
            config = {k: v for k, v in vars(config).items() if not k.startswith("_")}
        else:
            raise BootstrapConfigError("BootstrapConfig must be a dict-like object")

    port = config.get("port")
    if port is not None:
        if not isinstance(port, int) or isinstance(port, bool) or port < 0 or port > 65535:
            raise BootstrapConfigError(f"port must be an integer in [0, 65535], got {port!r}")

    for strkey in ("title", "host", "profile"):
        v = config.get(strkey)
        if v is not None and not isinstance(v, str):
            raise BootstrapConfigError(f"{strkey} must be a string")

    logger = config.get("logger")
    if logger is not None:
        if not isinstance(logger, dict):
            raise BootstrapConfigError("logger must be a dict")
        level = logger.get("level")
        if level is not None and str(level).lower() not in _VALID_LOG_LEVELS:
            raise BootstrapConfigError(f"logger.level invalid: {level}")

    paths = config.get("paths")
    if paths is not None:
        if not isinstance(paths, dict):
            raise BootstrapConfigError("paths must be a dict")
        for key in paths:
            if key not in _PATH_KEYS:
                raise BootstrapConfigError(f"unknown paths key: {key}")
    return config


def _to_list(v: Optional[StringOrArray]) -> List[str]:
    if v is None:
        return []
    if isinstance(v, str):
        return [v]
    return list(v)


def resolve_paths(paths: Optional[Dict[str, StringOrArray]], base_dir: str) -> ResolvedPaths:
    src = paths or {}
    out = ResolvedPaths()
    for key in _PATH_KEYS:
        entries = _to_list(src.get(key))
        getattr(out, key).extend(
            p if os.path.isabs(p) else os.path.normpath(os.path.join(base_dir, p))
            for p in entries
        )
    return out


def merge_config(
    defaults: Dict[str, Any] | BootstrapConfig,
    user: Dict[str, Any] | BootstrapConfig,
    base_dir: str,
) -> ResolvedBootstrapConfig:
    d = _as_dict(defaults)
    u = _as_dict(user)
    validate_bootstrap_config(d)
    validate_bootstrap_config(u)

    merged_paths: Dict[str, List[str]] = {}
    for key in _PATH_KEYS:
        merged_paths[key] = _to_list((d.get("paths") or {}).get(key)) + _to_list(
            (u.get("paths") or {}).get(key)
        )

    resolved = resolve_paths(merged_paths, base_dir)
    merged_logger = {**(d.get("logger") or {}), **(u.get("logger") or {})}
    merged_initial = {**(d.get("initial_state") or {}), **(u.get("initial_state") or {})}

    known = {"title", "port", "host", "profile", "logger", "paths", "initial_state"}
    extra = {**{k: v for k, v in d.items() if k not in known},
             **{k: v for k, v in u.items() if k not in known}}

    return ResolvedBootstrapConfig(
        title=u.get("title") or d.get("title") or "polyglot-server",
        port=u.get("port") if u.get("port") is not None else (d.get("port") if d.get("port") is not None else 3000),
        host=u.get("host") or d.get("host") or "0.0.0.0",
        profile=u.get("profile") or d.get("profile"),
        logger=merged_logger,
        paths=resolved,
        initial_state=merged_initial,
        extra=extra,
    )


def _as_dict(v: Any) -> Dict[str, Any]:
    if isinstance(v, dict):
        return v
    if isinstance(v, BootstrapConfig):
        out = {
            k: getattr(v, k)
            for k in ("title", "port", "host", "profile", "logger", "paths", "initial_state")
            if getattr(v, k) is not None
        }
        out.update(v.extra)
        return out
    raise BootstrapConfigError(f"cannot coerce {type(v).__name__} to config dict")


def create_loader_report(name: str) -> LoaderReport:
    return LoaderReport(name=name)


def report_error(report: LoaderReport, step: str, err: Any, path: Optional[str] = None) -> None:
    msg = str(err) if not isinstance(err, BaseException) else f"{type(err).__name__}: {err}"
    report.errors.append(LoaderReportError(step=step, error=msg, path=path))


_NUM_PREFIX_RE = re.compile(r"^(\d+)[_\-]")


def sort_by_numeric_prefix(paths: List[str]) -> List[str]:
    def key(p: str) -> tuple[int, str]:
        base = os.path.basename(p)
        m = _NUM_PREFIX_RE.match(base)
        return (int(m.group(1)) if m else 2**31 - 1, base)

    return sorted(paths, key=key)
