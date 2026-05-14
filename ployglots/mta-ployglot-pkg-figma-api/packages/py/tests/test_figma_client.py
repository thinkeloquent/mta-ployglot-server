from typing import ClassVar

import pytest

from figma_api import (
    FigmaAuthError,
    FigmaClient,
    FigmaNotFoundError,
    FigmaRateLimitError,
)

from ._helpers import FakeFetchClient, FakeResponse


def _resp_ok(body):
    return FakeResponse(status=200, body=body)


@pytest.mark.asyncio
async def test_routes_get_through_fetch_client():
    fake = FakeFetchClient(lambda _: _resp_ok({"id": "u1", "handle": "alice"}))
    client = FigmaClient(token="t", fetch_client=fake)
    me = await client.me.get()
    assert me["handle"] == "alice"
    assert fake.calls[0].method == "GET"
    assert fake.calls[0].path == "/v1/me"


@pytest.mark.asyncio
async def test_401_surfaces_auth_error():
    fake = FakeFetchClient(lambda _: FakeResponse(status=401, text_value="bad token"))
    client = FigmaClient(token="bad", fetch_client=fake)
    with pytest.raises(FigmaAuthError):
        await client.me.get()


@pytest.mark.asyncio
async def test_404_surfaces_notfound():
    fake = FakeFetchClient(lambda _: FakeResponse(status=404, text_value="nope"))
    client = FigmaClient(token="t", fetch_client=fake)
    with pytest.raises(FigmaNotFoundError):
        await client.files.get("missing")


@pytest.mark.asyncio
async def test_429_surfaces_ratelimit_with_retry_after():
    fake = FakeFetchClient(
        lambda _: FakeResponse(status=429, text_value="slow", headers_map={"retry-after": "7"})
    )
    client = FigmaClient(token="t", fetch_client=fake)
    with pytest.raises(FigmaRateLimitError) as exc:
        await client.me.get()
    assert exc.value.retry_after_seconds == 7


@pytest.mark.asyncio
async def test_files_get_passes_params():
    fake = FakeFetchClient(
        lambda _: _resp_ok({"name": "f", "lastModified": "x", "version": "1"})
    )
    client = FigmaClient(token="t", fetch_client=fake)
    await client.files.get("ABC/xyz", ids=["1:2", "3:4"], depth=2)
    assert fake.calls[0].path == "/v1/files/ABC%2Fxyz"
    assert fake.calls[0].kwargs["params"] == {"ids": "1:2,3:4", "depth": 2}


@pytest.mark.asyncio
async def test_comments_list_unwraps_envelope():
    fake = FakeFetchClient(lambda _: _resp_ok({"comments": [{"id": "c1", "message": "hi"}]}))
    client = FigmaClient(token="t", fetch_client=fake)
    comments = await client.comments.list("file")
    assert len(comments) == 1
    assert comments[0]["id"] == "c1"


@pytest.mark.asyncio
async def test_projects_list_for_team_returns_envelope():
    fake = FakeFetchClient(
        lambda _: _resp_ok({"name": "Team A", "projects": [{"id": "p1", "name": "P1"}]})
    )
    client = FigmaClient(token="t", fetch_client=fake)
    res = await client.projects.list_for_team("42")
    assert res["name"] == "Team A"
    assert len(res["projects"]) == 1


@pytest.mark.asyncio
async def test_aclose_delegates():
    fake = FakeFetchClient(lambda _: _resp_ok({}))
    async with FigmaClient(token="t", fetch_client=fake) as client:
        assert client is not None
    assert fake.closed is True


@pytest.mark.asyncio
async def test_json_decode_failure_on_get_raises():
    from figma_api import FigmaError

    class BadResp:
        status_code = 200
        headers: ClassVar[dict] = {}

        def json(self) -> dict:
            raise ValueError("bad json")

    class BadFake:
        async def get(self, *_a, **_k):
            return BadResp()

        async def post(self, *_a, **_k):
            return BadResp()

        async def delete(self, *_a, **_k):
            return BadResp()

        async def aclose(self) -> None:
            pass

    client = FigmaClient(token="t", fetch_client=BadFake())
    with pytest.raises(FigmaError):
        await client.me.get()


@pytest.mark.asyncio
async def test_delete_absorbs_empty_body():
    class EmptyResp:
        status_code = 204
        headers: ClassVar[dict] = {}

        def json(self) -> dict:
            raise ValueError("no body")

    class EmptyFake:
        async def get(self, *_a, **_k):
            return EmptyResp()

        async def post(self, *_a, **_k):
            return EmptyResp()

        async def delete(self, *_a, **_k):
            return EmptyResp()

        async def aclose(self) -> None:
            pass

    client = FigmaClient(token="t", fetch_client=EmptyFake())
    # delete allows empty bodies → returns None
    result = await client.comments.delete("F", "C1")
    assert result is None


@pytest.mark.asyncio
async def test_error_response_text_callable_branch():
    """If response.text is a callable (not a property), the client must call it."""
    from figma_api import FigmaAuthError

    class CallableTextResp:
        status_code = 401
        headers: ClassVar[dict] = {}

        def text(self) -> str:
            return "callable text body"

        def json(self) -> dict:
            raise ValueError("no body")

    class Fake:
        async def get(self, *_a, **_k):
            return CallableTextResp()

        async def post(self, *_a, **_k):
            return CallableTextResp()

        async def delete(self, *_a, **_k):
            return CallableTextResp()

        async def aclose(self) -> None:
            pass

    client = FigmaClient(token="t", fetch_client=Fake())
    with pytest.raises(FigmaAuthError):
        await client.me.get()


@pytest.mark.asyncio
async def test_error_response_text_raises_is_swallowed():
    """If reading .text throws, FigmaClient still surfaces the mapped HTTP error."""
    from figma_api import FigmaServerError

    class RaisingTextResp:
        status_code = 500
        headers: ClassVar[dict] = {}

        @property
        def text(self) -> str:
            raise RuntimeError("text broken")

        def json(self) -> dict:
            raise ValueError("no body")

    class Fake:
        async def get(self, *_a, **_k):
            return RaisingTextResp()

        async def post(self, *_a, **_k):
            return RaisingTextResp()

        async def delete(self, *_a, **_k):
            return RaisingTextResp()

        async def aclose(self) -> None:
            pass

    client = FigmaClient(token="t", fetch_client=Fake())
    with pytest.raises(FigmaServerError):
        await client.me.get()


@pytest.mark.asyncio
async def test_error_response_headers_get_raises_is_swallowed():
    """If response.headers.get throws, FigmaClient treats retry-after as None."""
    from figma_api import FigmaRateLimitError

    class BadHeaders:
        def get(self, _name: str) -> None:
            raise RuntimeError("headers broken")

    class RaisingHeadersResp:
        status_code = 429
        headers = BadHeaders()
        text = "throttled"

        def json(self) -> dict:
            raise ValueError("no body")

    class Fake:
        async def get(self, *_a, **_k):
            return RaisingHeadersResp()

        async def post(self, *_a, **_k):
            return RaisingHeadersResp()

        async def delete(self, *_a, **_k):
            return RaisingHeadersResp()

        async def aclose(self) -> None:
            pass

    client = FigmaClient(token="t", fetch_client=Fake())
    with pytest.raises(FigmaRateLimitError) as exc:
        await client.me.get()
    assert exc.value.retry_after_seconds is None


@pytest.mark.asyncio
async def test_fetch_client_without_aclose_is_tolerated():
    """FigmaClient.aclose() should be a no-op when the fetch client has no aclose."""

    class NoCloseFake:
        async def get(self, *_a, **_k):
            return _resp_ok({"id": "u1", "handle": "alice"})

        async def post(self, *_a, **_k):
            return _resp_ok({})

        async def delete(self, *_a, **_k):
            return _resp_ok({})

    client = FigmaClient(token="t", fetch_client=NoCloseFake())
    # Should not raise, even though there's no aclose attribute.
    await client.aclose()


def test_default_constructor_builds_fetch_client_and_logger(monkeypatch):
    monkeypatch.delenv("FIGMA_PASS", raising=False)
    client = FigmaClient(token="t")
    assert hasattr(client.fetch_client, "get")
    assert hasattr(client.logger, "info")
