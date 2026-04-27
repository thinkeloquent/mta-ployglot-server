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

from fastapi import Request

from fetch_http_client import AsyncClient


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
