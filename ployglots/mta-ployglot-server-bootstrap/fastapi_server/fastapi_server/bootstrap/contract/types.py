"""Bootstrap contract types — mirror of the TS side."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Union

StringOrArray = Union[str, List[str]]


@dataclass
class LoggerConfig:
    level: Optional[str] = None
    json_format: Optional[bool] = None
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class BootstrapPaths:
    environment: Optional[StringOrArray] = None
    lifecycles: Optional[StringOrArray] = None
    routes: Optional[StringOrArray] = None
    apps: Optional[StringOrArray] = None


@dataclass
class BootstrapConfig:
    title: Optional[str] = None
    port: Optional[int] = None
    host: Optional[str] = None
    profile: Optional[str] = None
    logger: Optional[Dict[str, Any]] = None
    paths: Optional[Dict[str, StringOrArray]] = None
    initial_state: Optional[Dict[str, Any]] = None
    extra: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "BootstrapConfig":
        known = {"title", "port", "host", "profile", "logger", "paths", "initial_state"}
        extra = {k: v for k, v in d.items() if k not in known}
        return cls(
            title=d.get("title"),
            port=d.get("port"),
            host=d.get("host"),
            profile=d.get("profile"),
            logger=d.get("logger"),
            paths=d.get("paths"),
            initial_state=d.get("initial_state"),
            extra=extra,
        )


@dataclass
class ResolvedPaths:
    environment: List[str] = field(default_factory=list)
    lifecycles: List[str] = field(default_factory=list)
    routes: List[str] = field(default_factory=list)
    apps: List[str] = field(default_factory=list)


@dataclass
class ResolvedBootstrapConfig:
    title: str
    port: int
    host: str
    paths: ResolvedPaths
    logger: Dict[str, Any]
    initial_state: Dict[str, Any]
    profile: Optional[str] = None
    extra: Dict[str, Any] = field(default_factory=dict)


@dataclass
class LoaderReportError:
    step: str
    error: str
    path: Optional[str] = None


@dataclass
class LoaderReport:
    name: str
    discovered: int = 0
    validated: int = 0
    imported: int = 0
    registered: int = 0
    skipped: int = 0
    errors: List[LoaderReportError] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)


HookFn = Callable[[Any, ResolvedBootstrapConfig], Any]


@dataclass
class HookCollector:
    init: List[HookFn] = field(default_factory=list)
    startup: List[HookFn] = field(default_factory=list)
    shutdown: List[HookFn] = field(default_factory=list)
