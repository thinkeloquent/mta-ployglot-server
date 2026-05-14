from __future__ import annotations

import copy
import inspect
import logging
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional

from fastapi import APIRouter, FastAPI, Request
from starlette.middleware.base import BaseHTTPMiddleware

from fastapi_server.bootstrap.contract import ResolvedBootstrapConfig


log = logging.getLogger("polyglot.fastapi")


@dataclass
class FastapiAdapter:
    """Pure-data adapter record; methods are attached below as free functions for clarity."""

    name: str = "fastapi"

    def create_server(self, config: ResolvedBootstrapConfig) -> FastAPI:
        app = FastAPI(title=config.title, lifespan=_make_lifespan())
        app.state.startup_hooks = []
        app.state.shutdown_hooks = []
        app.state.init_hooks_ran = False
        _configure_logging(config)
        return app

    def decorate(self, app: FastAPI, key: str, value: Any) -> None:
        setattr(app.state, key, value)

    def has_decorator(self, app: FastAPI, key: str) -> bool:
        return hasattr(app.state, key)

    def on_close(self, app: FastAPI, fn: Callable[[], Any]) -> None:
        app.state.shutdown_hooks.append(_wrap_noargs(fn))  # type: ignore[attr-defined]

    def attach_request_state(self, app: FastAPI, initial_state: Dict[str, Any]) -> None:
        app.add_middleware(_RequestStateMiddleware, initial_state=initial_state)

    def register_graceful_shutdown(self, app: FastAPI) -> None:
        # FastAPI/uvicorn handles SIGTERM itself; no-op but leave a marker.
        app.state.graceful_shutdown_registered = True  # type: ignore[attr-defined]

    def schedule_hooks(
        self,
        app: FastAPI,
        hooks: Dict[str, List[Callable]],
        config: ResolvedBootstrapConfig,
    ) -> None:
        app.state.startup_hooks.extend(hooks.get("startup", []))  # type: ignore[attr-defined]
        app.state.shutdown_hooks.extend(hooks.get("shutdown", []))  # type: ignore[attr-defined]
        app.state.resolved_config = config  # type: ignore[attr-defined]

    def register_routes(
        self,
        app: FastAPI,
        fn: Callable[[FastAPI, ResolvedBootstrapConfig], Any],
    ) -> None:
        config: ResolvedBootstrapConfig = getattr(app.state, "_config")
        result = fn(app, config)
        if isinstance(result, APIRouter):
            app.include_router(result)
        elif inspect.isawaitable(result):
            raise RuntimeError(
                "route registrar returned an awaitable; FastAPI adapter expects sync registration. "
                "Run your async setup inside an app.on_event('startup') hook instead."
            )


def create_fastapi_adapter() -> FastapiAdapter:
    return FastapiAdapter()


def _configure_logging(config: ResolvedBootstrapConfig) -> None:
    level_name = (config.logger or {}).get("level") if config.logger else None
    if level_name:
        level = getattr(logging, str(level_name).upper(), logging.INFO)
        logging.basicConfig(level=level)


def _make_lifespan():
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        for fn in list(getattr(app.state, "startup_hooks", [])):
            label = getattr(fn, "__name__", "anonymous")
            try:
                result = fn(app, getattr(app.state, "resolved_config", None))
                if inspect.isawaitable(result):
                    await result
                log.debug("startup hook '%s' complete", label)
            except Exception:  # noqa: BLE001
                log.exception("startup hook '%s' failed", label)
        try:
            yield
        finally:
            for fn in list(getattr(app.state, "shutdown_hooks", [])):
                label = getattr(fn, "__name__", "anonymous")
                try:
                    result = fn(app, getattr(app.state, "resolved_config", None))
                    if inspect.isawaitable(result):
                        await result
                    log.debug("shutdown hook '%s' complete", label)
                except Exception:  # noqa: BLE001
                    log.exception("shutdown hook '%s' failed", label)

    return lifespan


def _wrap_noargs(fn: Callable[[], Any]):
    async def wrapper(_app: FastAPI, _config: Any) -> None:
        result = fn()
        if inspect.isawaitable(result):
            await result

    wrapper.__name__ = getattr(fn, "__name__", "anonymous")  # type: ignore[attr-defined]
    return wrapper


class _RequestStateMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, initial_state: Dict[str, Any]) -> None:
        super().__init__(app)
        self._initial = initial_state

    async def dispatch(self, request: Request, call_next):
        cloned = copy.deepcopy(self._initial)
        request.state.state = cloned
        for k, v in cloned.items():
            setattr(request.state, k, v)
        return await call_next(request)
