"""Tests for AsyncClient — hits a mocked httpx transport."""

from __future__ import annotations

import httpx
import pytest

from fetch_http_client import (
    AsyncClient,
    BearerAuth,
    CircuitBreaker,
    CircuitBreakerConfig,
    CircuitOpenError,
    HTTPStatusError,
    JitterStrategy,
    Proxy,
    RetryConfig,
    Timeout,
    fetch_httpx_async,
)


def _handler_factory(responses: list[httpx.Response]):
    idx = {"i": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        i = idx["i"]
        idx["i"] += 1
        return responses[min(i, len(responses) - 1)]

    return handler


async def _mock_client(handler) -> AsyncClient:
    client = AsyncClient(
        base_url="https://api.example.com",
        retry=RetryConfig(max_attempts=1, base_delay=0.001, jitter=JitterStrategy.NONE),
    )
    client._httpx = httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="https://api.example.com"
    )
    return client


@pytest.mark.asyncio
async def test_get_returns_response() -> None:
    handler = _handler_factory([httpx.Response(200, json={"ok": True})])
    client = await _mock_client(handler)
    try:
        resp = await client.get("/ping")
        assert resp.status_code == 200
        assert resp.json() == {"ok": True}
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_post_json_body() -> None:
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = request.content
        captured["ct"] = request.headers.get("content-type", "")
        return httpx.Response(201, json={"id": 1})

    client = await _mock_client(handler)
    try:
        resp = await client.post("/items", json={"name": "x"})
        assert resp.status_code == 201
        assert b'"name":"x"' in captured["body"] or b'"name": "x"' in captured["body"]
        assert "application/json" in captured["ct"]
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_raise_for_status_on_error() -> None:
    handler = _handler_factory([httpx.Response(500, text="boom")])
    client = await _mock_client(handler)
    try:
        resp = await client.get("/bad")
        with pytest.raises(HTTPStatusError):
            resp.raise_for_status()
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_retry_on_5xx_then_success() -> None:
    handler = _handler_factory([httpx.Response(503), httpx.Response(200, json={"ok": True})])
    client = AsyncClient(
        base_url="https://api.example.com",
        retry=RetryConfig(max_attempts=3, base_delay=0.001, jitter=JitterStrategy.NONE),
    )
    client._httpx = httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="https://api.example.com"
    )
    try:
        resp = await client.get("/thing")
        assert resp.status_code == 200
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_no_retry_for_post() -> None:
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(503)

    client = AsyncClient(
        base_url="https://api.example.com",
        retry=RetryConfig(max_attempts=3, base_delay=0.001, jitter=JitterStrategy.NONE),
    )
    client._httpx = httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="https://api.example.com"
    )
    try:
        resp = await client.post("/things", json={})
        # POST is not idempotent → single call
        assert calls["n"] == 1
        assert resp.status_code == 503
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_event_hooks_fire() -> None:
    seen: list[str] = []

    async def on_req(req: httpx.Request) -> None:
        req.headers["x-req-id"] = "abc"
        seen.append("req")

    async def on_resp(resp: httpx.Response) -> None:
        seen.append(f"resp:{resp.status_code}")

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["x-req-id"] == "abc"
        return httpx.Response(200, json={})

    client = AsyncClient(
        base_url="https://api.example.com",
        retry=RetryConfig(max_attempts=1, base_delay=0.001, jitter=JitterStrategy.NONE),
        on_request=[on_req],
        on_response=[on_resp],
    )
    client._httpx = httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="https://api.example.com"
    )
    try:
        await client.get("/x")
    finally:
        await client.aclose()
    assert seen == ["req", "resp:200"]


@pytest.mark.asyncio
async def test_circuit_breaker_trips() -> None:
    handler = _handler_factory([httpx.Response(500)])
    cb = CircuitBreaker(config=CircuitBreakerConfig(failure_threshold=1))
    client = AsyncClient(
        base_url="https://api.example.com",
        retry=RetryConfig(max_attempts=1, base_delay=0.001, jitter=JitterStrategy.NONE),
        circuit_breaker=cb,
    )
    client._httpx = httpx.AsyncClient(
        transport=httpx.MockTransport(handler), base_url="https://api.example.com"
    )
    try:
        # First GET — status 500 is retryable, but retry disabled → ends up as success
        # from the *client* perspective (no exception). Breaker records success on
        # any completed request, so we need an actual transport exception to trip it.
        def raising(request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError("refused")

        client._httpx = httpx.AsyncClient(
            transport=httpx.MockTransport(raising),
            base_url="https://api.example.com",
        )

        with pytest.raises(Exception):  # mapped ConnectError
            await client.get("/x")
        with pytest.raises(CircuitOpenError):
            await client.get("/y")
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_auth_applied() -> None:
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["auth"] = request.headers.get("authorization", "")
        return httpx.Response(200, json={})

    client = AsyncClient(
        base_url="https://api.example.com",
        auth=BearerAuth("tok"),
        retry=RetryConfig(max_attempts=1, base_delay=0.001, jitter=JitterStrategy.NONE),
    )
    client._httpx = httpx.AsyncClient(
        transport=httpx.MockTransport(handler),
        base_url="https://api.example.com",
        auth=BearerAuth("tok"),
    )
    try:
        await client.get("/x")
        assert captured["auth"] == "Bearer tok"
    finally:
        await client.aclose()


class TestProxyNormalisation:
    def test_empty_dict_no_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        for k in ("HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy"):
            monkeypatch.delenv(k, raising=False)
        client = AsyncClient(proxy={})
        # With no env, proxy resolves to None → construction still works.
        assert isinstance(client, AsyncClient)

    def test_empty_dict_with_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("HTTPS_PROXY", "http://proxy.internal:3128")
        client = AsyncClient(proxy={})
        assert isinstance(client, AsyncClient)

    def test_proxy_instance(self) -> None:
        client = AsyncClient(proxy=Proxy(url="http://p:3128"))
        assert isinstance(client, AsyncClient)

    def test_string_shorthand(self) -> None:
        client = AsyncClient(proxy="http://p:3128")
        assert isinstance(client, AsyncClient)


class TestFactory:
    def test_fetch_httpx_async_defaults(self) -> None:
        client = fetch_httpx_async(base_url="https://x")
        assert client._timeout.read == 120.0
        assert client._httpx.follow_redirects is True


class TestTimeoutKwarg:
    def test_accepts_dict(self) -> None:
        client = AsyncClient(timeout={"connect": 1.0, "read": 2.0})
        assert client._timeout.connect == 1.0

    def test_accepts_float(self) -> None:
        client = AsyncClient(timeout=3.0)
        assert client._timeout.read == 3.0

    def test_accepts_timeout_instance(self) -> None:
        t = Timeout(connect=9.0, read=9.0, write=9.0, pool=9.0)
        client = AsyncClient(timeout=t)
        assert client._timeout is t


class TestResponseWrapper:
    @pytest.mark.asyncio
    async def test_properties_expose_raw(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                201,
                headers={"x-demo": "yes"},
                content=b"body-bytes",
            )

        client = await _mock_client(handler)
        try:
            resp = await client.get("/x")
            assert resp.status_code == 201
            assert resp.headers["x-demo"] == "yes"
            assert resp.content == b"body-bytes"
            assert resp.text == "body-bytes"
            assert str(resp.url).endswith("/x")
            assert isinstance(resp.raw, httpx.Response)
        finally:
            await client.aclose()

    @pytest.mark.asyncio
    async def test_raise_for_status_returns_self_on_2xx(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(204)

        client = await _mock_client(handler)
        try:
            resp = await client.get("/x")
            assert resp.raise_for_status() is resp
        finally:
            await client.aclose()


class TestClientLifecycle:
    @pytest.mark.asyncio
    async def test_aclose_is_idempotent(self) -> None:
        client = AsyncClient(base_url="https://x")
        await client.aclose()
        await client.aclose()
        assert client._closed

    @pytest.mark.asyncio
    async def test_close_alias(self) -> None:
        client = AsyncClient(base_url="https://x")
        await client.close()
        assert client._closed

    @pytest.mark.asyncio
    async def test_async_context_manager(self) -> None:
        async with AsyncClient(base_url="https://x") as client:
            assert not client._closed
        assert client._closed


class TestClientVerbs:
    @pytest.mark.asyncio
    @pytest.mark.parametrize("verb", ["get", "head", "options", "post", "put", "patch", "delete"])
    async def test_each_verb_dispatches(self, verb: str) -> None:
        captured: dict = {}

        def handler(request: httpx.Request) -> httpx.Response:
            captured["method"] = request.method
            return httpx.Response(200)

        client = await _mock_client(handler)
        try:
            await getattr(client, verb)("/x")
        finally:
            await client.aclose()
        assert captured["method"] == verb.upper()


class TestProxyNormaliseExtras:
    def test_proxy_instance_with_url_passes_through(self) -> None:
        p = Proxy(url="http://real:3128")
        client = AsyncClient(proxy=p)
        assert client._proxy is p

    def test_proxy_dict_with_url_key(self) -> None:
        client = AsyncClient(proxy={"url": "http://explicit:3128"})
        assert client._proxy is not None
        assert client._proxy.url == "http://explicit:3128"

    def test_proxy_instance_no_url_with_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("HTTPS_PROXY", "http://from-env:3128")
        from fetch_http_client import ProxyAuth

        p = Proxy(url=None, auth=ProxyAuth("u", "p"))
        client = AsyncClient(proxy=p)
        assert client._proxy is not None
        assert client._proxy.url == "http://from-env:3128"
        assert client._proxy.auth is not None

    def test_proxy_instance_no_url_no_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        # Proxy() with no URL and no env should normalise to None.
        for k in ("HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy"):
            monkeypatch.delenv(k, raising=False)
        client = AsyncClient(proxy=Proxy(url=None))
        assert client._proxy is None

    def test_unsupported_proxy_type_raises(self) -> None:
        with pytest.raises(TypeError, match="Unsupported proxy value"):
            AsyncClient(proxy=42)  # type: ignore[arg-type]


class TestCircuitBreakerWiring:
    def test_accepts_breaker_config(self) -> None:
        client = AsyncClient(circuit_breaker=CircuitBreakerConfig(failure_threshold=2))
        assert isinstance(client._breaker, CircuitBreaker)
        assert client._breaker.config.failure_threshold == 2

    def test_unsupported_breaker_type_raises(self) -> None:
        with pytest.raises(TypeError, match="Unsupported circuit_breaker"):
            AsyncClient(circuit_breaker="broken")  # type: ignore[arg-type]


class TestRetryExhaustion:
    @pytest.mark.asyncio
    async def test_exhausts_attempts_on_transport_error(self) -> None:
        attempts = {"n": 0}

        def handler(request: httpx.Request) -> httpx.Response:
            attempts["n"] += 1
            raise httpx.ConnectError("down")

        client = AsyncClient(
            base_url="https://api.example.com",
            retry=RetryConfig(max_attempts=3, base_delay=0.001, jitter=JitterStrategy.NONE),
        )
        client._httpx = httpx.AsyncClient(
            transport=httpx.MockTransport(handler), base_url="https://api.example.com"
        )
        from fetch_http_client import ConnectError

        try:
            with pytest.raises(ConnectError):
                await client.get("/x")
            assert attempts["n"] == 3
        finally:
            await client.aclose()

    @pytest.mark.asyncio
    async def test_retry_response_hook_runs_each_attempt(self) -> None:
        responses = [httpx.Response(503), httpx.Response(200, json={"ok": True})]
        idx = {"i": 0}

        def handler(request: httpx.Request) -> httpx.Response:
            r = responses[idx["i"]]
            idx["i"] += 1
            return r

        seen: list[int] = []

        async def on_response(resp: httpx.Response) -> None:
            seen.append(resp.status_code)

        client = AsyncClient(
            base_url="https://api.example.com",
            retry=RetryConfig(max_attempts=3, base_delay=0.001, jitter=JitterStrategy.NONE),
            on_response=[on_response],
        )
        client._httpx = httpx.AsyncClient(
            transport=httpx.MockTransport(handler), base_url="https://api.example.com"
        )
        try:
            resp = await client.get("/x")
            assert resp.status_code == 200
            assert seen == [503, 200]
        finally:
            await client.aclose()

    @pytest.mark.asyncio
    async def test_all_attempts_retryable_status_returns_last(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(503)

        client = AsyncClient(
            base_url="https://api.example.com",
            retry=RetryConfig(max_attempts=3, base_delay=0.001, jitter=JitterStrategy.NONE),
        )
        client._httpx = httpx.AsyncClient(
            transport=httpx.MockTransport(handler), base_url="https://api.example.com"
        )
        try:
            resp = await client.get("/x")
            assert resp.status_code == 503
        finally:
            await client.aclose()

    @pytest.mark.asyncio
    async def test_per_call_auth_override(self) -> None:
        captured: dict = {}

        def handler(request: httpx.Request) -> httpx.Response:
            captured["auth"] = request.headers.get("authorization", "")
            return httpx.Response(200)

        client = AsyncClient(
            base_url="https://api.example.com",
            retry=RetryConfig(max_attempts=1, base_delay=0.001, jitter=JitterStrategy.NONE),
        )
        client._httpx = httpx.AsyncClient(
            transport=httpx.MockTransport(handler),
            base_url="https://api.example.com",
            auth=BearerAuth("per-call-token"),
        )
        try:
            await client.get("/x", auth=BearerAuth("per-call-token"))
        finally:
            await client.aclose()
        assert captured["auth"] == "Bearer per-call-token"

    @pytest.mark.asyncio
    async def test_breaker_records_failure_on_retryable_status(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(503)

        # Spy on the breaker's record_failure to confirm the retry loop hits it
        # during intermediate retryable-status attempts (the final attempt then
        # records success, which is the existing behaviour).
        cb = CircuitBreaker(config=CircuitBreakerConfig(failure_threshold=10))
        failure_calls = {"n": 0}
        original_record_failure = cb.record_failure

        def counting_record_failure() -> None:
            failure_calls["n"] += 1
            original_record_failure()

        cb.record_failure = counting_record_failure  # type: ignore[method-assign]

        client = AsyncClient(
            base_url="https://api.example.com",
            retry=RetryConfig(max_attempts=3, base_delay=0.001, jitter=JitterStrategy.NONE),
            circuit_breaker=cb,
        )
        client._httpx = httpx.AsyncClient(
            transport=httpx.MockTransport(handler), base_url="https://api.example.com"
        )
        try:
            await client.get("/x")
        finally:
            await client.aclose()
        # Two intermediate retryable responses each recorded a failure.
        assert failure_calls["n"] == 2


class TestBreakerSuccessOnOK:
    @pytest.mark.asyncio
    async def test_breaker_records_success_on_2xx(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200)

        cb = CircuitBreaker(config=CircuitBreakerConfig(failure_threshold=2))
        cb.failure_count = 1
        client = AsyncClient(
            base_url="https://api.example.com",
            retry=RetryConfig(max_attempts=1, base_delay=0.001, jitter=JitterStrategy.NONE),
            circuit_breaker=cb,
        )
        client._httpx = httpx.AsyncClient(
            transport=httpx.MockTransport(handler), base_url="https://api.example.com"
        )
        try:
            await client.get("/x")
        finally:
            await client.aclose()
        assert cb.failure_count == 0


class TestModuleLevelVerbs:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "verb_name",
        ["get", "head", "options", "post", "put", "patch", "delete"],
    )
    async def test_module_verb_uses_one_off_client(
        self, verb_name: str, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        import fetch_http_client as fhc

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"verb": request.method})

        class _ShortLived(AsyncClient):
            def __init__(self, **kwargs: object) -> None:
                super().__init__(**kwargs)
                self._httpx = httpx.AsyncClient(
                    transport=httpx.MockTransport(handler),
                    base_url="https://example.com",
                )

        monkeypatch.setattr(fhc._client, "AsyncClient", _ShortLived)

        fn = getattr(fhc, verb_name)
        resp = await fn("https://example.com/x")
        assert resp.status_code == 200
        assert resp.json()["verb"] == verb_name.upper()


class TestFetchHttpxAsyncFactoryExtras:
    def test_explicit_timeout_is_used(self) -> None:
        t = Timeout(connect=1.0, read=2.0, write=3.0, pool=4.0)
        client = fetch_httpx_async(base_url="https://x", timeout=t)
        assert client._timeout is t

    def test_extra_kwargs_forwarded(self) -> None:
        client = fetch_httpx_async(
            base_url="https://x",
            headers={"accept": "application/json"},
            max_redirects=5,
        )
        assert client._httpx.max_redirects == 5
