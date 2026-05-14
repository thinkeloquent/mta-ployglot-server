"""Polyglot bootstrap: runtime-neutral orchestrator for FastAPI + Fastify."""

from fastapi_server.bootstrap.contract import (
    BootstrapConfig,
    LoaderReport,
    LoaderReportError,
    ResolvedBootstrapConfig,
    ResolvedPaths,
    BootstrapConfigError,
    create_loader_report,
    merge_config,
    resolve_paths,
    sort_by_numeric_prefix,
    validate_bootstrap_config,
)
from fastapi_server.bootstrap.core import setup, SetupOptions
from fastapi_server.bootstrap.registry import Addon, Registry, RuntimeContext, compose_addons
from fastapi_server.bootstrap.adapters import create_fastapi_adapter
from fastapi_server.bootstrap.addons import environment_addon, lifecycle_addon, route_addon

__all__ = [
    "BootstrapConfig",
    "LoaderReport",
    "LoaderReportError",
    "ResolvedBootstrapConfig",
    "ResolvedPaths",
    "BootstrapConfigError",
    "create_loader_report",
    "merge_config",
    "resolve_paths",
    "sort_by_numeric_prefix",
    "validate_bootstrap_config",
    "setup",
    "SetupOptions",
    "Addon",
    "Registry",
    "RuntimeContext",
    "compose_addons",
    "create_fastapi_adapter",
    "environment_addon",
    "lifecycle_addon",
    "route_addon",
]
