"""Depends()-injectable per-provider AsyncClient factories.

Usage in a route file::

    from fastapi import APIRouter, Depends
    from fetch_http_client import AsyncClient
    from ._di import get_jira_client

    router = APIRouter()

    @router.get("/healthz/integrations/jira/myself")
    async def jira_myself(client: AsyncClient = Depends(get_jira_client)):
        resp = await client.get("/rest/api/3/myself")
        ...

Test override pattern::

    @pytest.fixture
    def stub_jira():
        class StubResp:
            def raise_for_status(self): pass
            def json(self): return {"accountId": "x", "displayName": "Stub"}
        class StubClient:
            async def get(self, _path): return StubResp()
            async def aclose(self): pass
        return StubClient()

    def test_jira_myself(stub_jira):
        from main import build_app
        app = asyncio.run(build_app())
        async def override():
            return stub_jira
        app.dependency_overrides[get_jira_client] = override
        with TestClient(app) as c:
            r = c.get("/healthz/integrations/jira/myself")
            assert r.status_code == 200
            assert r.json()["data"]["accountId"] == "x"
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import Request

from fetch_http_client import AsyncClient

# Helper classes live in sibling `_<name>.py` modules under
# `config/lifecycles/`. The route addon loads files in this directory via a
# path-based importer that does not establish a deep enough package context
# for `..lifecycles` to resolve at runtime — relative imports across sibling
# directories raise "attempted relative import beyond top-level package".
# `from __future__ import annotations` (above) postpones annotation
# evaluation, so the names below are only needed at type-check time.
if TYPE_CHECKING:
    from ..lifecycles._app_yaml_config import ConfigHandle
    from ..lifecycles._app_yaml_fetch_config import FetchConfigHandle
    from ..lifecycles._app_yaml_from_context import ApplierHandle
    from ..lifecycles._app_yaml_loader import LoaderHandle
    from ..lifecycles._env_resolve import EnvResolver
    from ..lifecycles._runtime_template_resolver import ResolverHandle


async def get_env_resolve(request: Request) -> EnvResolver:
    """Depends() provider for the env-resolve helper.

    Raises if the 15_env_resolve lifecycle did not run (e.g. lifecycle file
    renamed or removed). Routes that need config resolution should add::

        resolver: EnvResolver = Depends(get_env_resolve)
    """
    resolver = getattr(request.app.state, "env_resolve", None)
    if resolver is None:
        raise RuntimeError(
            "env_resolve missing — confirm 15_env_resolve.lifecycle.py is loaded"
        )
    return resolver


async def get_app_yaml_loader(request: Request) -> LoaderHandle:
    """Depends() provider for the app-yaml-loader handle."""
    handle = getattr(request.app.state, "app_yaml_loader", None)
    if handle is None:
        raise RuntimeError(
            "app_yaml_loader missing — confirm 25_app_yaml_loader.lifecycle.py is loaded"
        )
    return handle


async def get_runtime_template_resolver(request: Request) -> ResolverHandle:
    handle = getattr(request.app.state, "runtime_template_resolver", None)
    if handle is None:
        raise RuntimeError(
            "runtime_template_resolver missing — confirm 26_runtime_template_resolver.lifecycle.py is loaded"
        )
    return handle


async def get_app_yaml_config(request: Request) -> ConfigHandle:
    handle = getattr(request.app.state, "app_yaml_config", None)
    if handle is None:
        raise RuntimeError(
            "app_yaml_config missing — confirm 27_app_yaml_config.lifecycle.py is loaded"
        )
    return handle


async def get_app_yaml_applier(request: Request) -> ApplierHandle:
    handle = getattr(request.app.state, "app_yaml_applier", None)
    if handle is None:
        raise RuntimeError(
            "app_yaml_applier missing — confirm 28_app_yaml_from_context.lifecycle.py is loaded"
        )
    return handle


async def get_app_yaml_fetch_config(request: Request) -> FetchConfigHandle:
    handle = getattr(request.app.state, "app_yaml_fetch_config", None)
    if handle is None:
        raise RuntimeError(
            "app_yaml_fetch_config missing — confirm 29_app_yaml_fetch_config.lifecycle.py is loaded"
        )
    return handle


async def _get(name: str, request: Request) -> AsyncClient:
    registry = getattr(request.app.state, "fetch_clients", None)
    if registry is None:
        raise RuntimeError(
            "FetchClientRegistry missing — confirm 20_fetch_clients.lifecycle.py is loaded"
        )
    return await registry.get(name)


async def get_jira_client(request: Request) -> AsyncClient:
    return await _get("jira", request)


async def get_confluence_client(request: Request) -> AsyncClient:
    return await _get("confluence", request)


async def get_github_client(request: Request) -> AsyncClient:
    return await _get("github", request)


async def get_figma_client(request: Request) -> AsyncClient:
    return await _get("figma", request)


async def get_statsig_client(request: Request) -> AsyncClient:
    return await _get("statsig", request)


async def get_saucelabs_client(request: Request) -> AsyncClient:
    return await _get("saucelabs", request)
