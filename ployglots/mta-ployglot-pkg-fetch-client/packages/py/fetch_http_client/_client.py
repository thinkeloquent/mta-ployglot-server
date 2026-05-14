"""AsyncClient — the fan-in junction.

Wraps `httpx.AsyncClient` with:
- typed auth (BasicAuth/BearerAuth/APIKeyAuth/DigestAuth or tuple/str)
- Timeout / Limits / Proxy normalisation (auto-detect from env on Proxy())
- retry loop with configurable jitter
- circuit breaker gating
- event hooks (on_request / on_response)
- mapped exception hierarchy
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable, Iterable, Mapping
from types import TracebackType
from typing import Any

import httpx

from ._auth import Auth, build_auth
from ._cache import CacheConfig, CacheManager, MemoryStorage
from ._config import (
    DEFAULT_LIMITS,
    DEFAULT_TIMEOUT,
    Limits,
    Proxy,
    Timeout,
    get_proxy_from_env,
)
from ._exceptions import HTTPStatusError, map_exception
from ._logger import Logger, create_logger
from ._retry import (
    CircuitBreaker,
    CircuitBreakerConfig,
    RetryConfig,
)

RequestHook = Callable[[httpx.Request], Awaitable[None]]
ResponseHook = Callable[[httpx.Response], Awaitable[None]]


class Response:
    """Thin wrapper over httpx.Response — just enough for ergonomic access."""

    def __init__(self, raw: httpx.Response) -> None:
        self._raw = raw

    @property
    def status_code(self) -> int:
        return self._raw.status_code

    @property
    def status(self) -> str:
        """Textual reason phrase for `status_code` (e.g. "OK", "Not Found").

        Note: this intentionally diverges from the Web Fetch API where
        `Response.status` is the integer; here `Response.status` is the text
        and `Response.status_code` is the integer.
        """
        return self._raw.reason_phrase

    @property
    def headers(self) -> httpx.Headers:
        return self._raw.headers

    @property
    def url(self) -> httpx.URL:
        return self._raw.url

    @property
    def text(self) -> str:
        return self._raw.text

    @property
    def content(self) -> bytes:
        return self._raw.content

    def json(self, **kwargs: Any) -> Any:
        return self._raw.json(**kwargs)

    def raise_for_status(self) -> Response:
        if self._raw.is_error:
            raise HTTPStatusError(
                f"HTTP {self._raw.status_code} for {self._raw.request.method} {self._raw.request.url}",
                request=None,
                response=self,
            )
        return self

    # Forward-compat for callers that expect raw httpx.Response access.
    @property
    def raw(self) -> httpx.Response:
        return self._raw


class AsyncClient:
    """Async HTTP client.

    Parameters are a superset of httpx.AsyncClient's; extra kwargs drive
    retry, circuit-breaker, and event hooks. Closing is required — use
    as an async context manager, or call `await client.aclose()`.
    """

    def __init__(
        self,
        *,
        base_url: str = "",
        auth: Any = None,
        headers: Mapping[str, str] | None = None,
        params: Mapping[str, Any] | None = None,
        cookies: Mapping[str, str] | None = None,
        timeout: Timeout | float | dict | None = None,
        limits: Limits | None = None,
        proxy: Proxy | str | dict | None = None,
        verify: bool | str = True,
        cert: str | tuple[str, str] | None = None,
        http2: bool = False,
        follow_redirects: bool = False,
        max_redirects: int = 20,
        trust_env: bool = True,
        retry: RetryConfig | None = None,
        circuit_breaker: CircuitBreaker | CircuitBreakerConfig | None = None,
        on_request: Iterable[RequestHook] | None = None,
        on_response: Iterable[ResponseHook] | None = None,
        logger: Logger | None = None,
    ) -> None:
        self._timeout = self._normalise_timeout(timeout)
        self._limits = limits or DEFAULT_LIMITS
        self._proxy = self._normalise_proxy(proxy)
        self._auth: Auth | None = build_auth(auth)
        self._retry = retry or RetryConfig()
        self._breaker = self._normalise_breaker(circuit_breaker)
        self._on_request = list(on_request or [])
        self._on_response = list(on_response or [])
        self._logger = logger or create_logger("fetch_http_client.client", base_url=base_url)

        proxy_url = self._proxy.resolved_url() if self._proxy else None

        self._httpx = httpx.AsyncClient(
            base_url=base_url,
            auth=self._auth,
            headers=dict(headers) if headers else None,
            params=dict(params) if params else None,
            cookies=dict(cookies) if cookies else None,
            timeout=self._timeout.to_httpx(),
            limits=self._limits.to_httpx(),
            proxy=proxy_url,
            verify=verify,
            cert=cert,
            http2=http2,
            follow_redirects=follow_redirects,
            max_redirects=max_redirects,
            trust_env=trust_env,
        )
        self._closed = False

    # ---- normalisers --------------------------------------------------------

    @staticmethod
    def _normalise_timeout(value: Any) -> Timeout:
        if value is None:
            return DEFAULT_TIMEOUT
        if isinstance(value, Timeout):
            return value
        return Timeout.from_any(value)

    @staticmethod
    def _normalise_proxy(value: Any) -> Proxy | None:
        if value is None:
            return None
        if isinstance(value, Proxy):
            if value.url is None:
                env_url = get_proxy_from_env()
                if env_url is None:
                    return None
                return Proxy(url=env_url, auth=value.auth, headers=value.headers)
            return value
        if isinstance(value, str):
            return Proxy(url=value)
        if isinstance(value, dict):
            if not value:
                env_url = get_proxy_from_env()
                return Proxy(url=env_url) if env_url else None
            return Proxy(url=value.get("url"), headers=value.get("headers", {}))
        raise TypeError(f"Unsupported proxy value: {type(value).__name__}")

    @staticmethod
    def _normalise_breaker(value: Any) -> CircuitBreaker | None:
        if value is None:
            return None
        if isinstance(value, CircuitBreaker):
            return value
        if isinstance(value, CircuitBreakerConfig):
            return CircuitBreaker(config=value)
        raise TypeError(f"Unsupported circuit_breaker value: {type(value).__name__}")

    # ---- lifecycle ----------------------------------------------------------

    async def __aenter__(self) -> AsyncClient:
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        if self._closed:
            return
        self._closed = True
        await self._httpx.aclose()

    # alias for symmetry with TS `close()`
    close = aclose

    # ---- core send ----------------------------------------------------------

    async def request(
        self,
        method: str,
        url: str,
        *,
        params: Mapping[str, Any] | None = None,
        headers: Mapping[str, str] | None = None,
        json: Any = None,
        data: Any = None,
        content: bytes | str | None = None,
        files: Any = None,
        cookies: Mapping[str, str] | None = None,
        timeout: Timeout | float | dict | None = None,
        follow_redirects: bool | None = None,
        auth: Any = None,
    ) -> Response:
        if self._breaker is not None:
            self._breaker.check()

        req = self._httpx.build_request(
            method.upper(),
            url,
            params=dict(params) if params else None,
            headers=dict(headers) if headers else None,
            json=json,
            data=data,
            content=content,
            files=files,
            cookies=dict(cookies) if cookies else None,
            timeout=self._normalise_timeout(timeout).to_httpx() if timeout else None,
        )

        for hook in self._on_request:
            await hook(req)

        retry = self._retry
        last_exc: Exception | None = None
        delay = retry.base_delay
        method_upper = method.upper()

        for attempt in range(retry.max_attempts):
            try:
                raw = await self._httpx.send(
                    req,
                    follow_redirects=(
                        follow_redirects
                        if follow_redirects is not None
                        else self._httpx.follow_redirects
                    ),
                    auth=build_auth(auth) if auth is not None else httpx.USE_CLIENT_DEFAULT,
                )
            except httpx.HTTPError as exc:
                mapped = map_exception(exc)
                last_exc = mapped
                if self._breaker is not None:
                    self._breaker.record_failure()
                if method_upper not in retry.retry_methods or attempt == retry.max_attempts - 1:
                    self._logger.warn(
                        "request failed",
                        method=method_upper,
                        url=str(req.url),
                        attempt=attempt + 1,
                        error=str(exc),
                    )
                    raise mapped from exc
                delay = retry.compute_delay(attempt, previous_delay=delay)
                self._logger.debug(
                    "retrying",
                    method=method_upper,
                    url=str(req.url),
                    attempt=attempt + 1,
                    delay_ms=int(delay * 1000),
                )
                await asyncio.sleep(delay)
                continue

            for hook in self._on_response:
                await hook(raw)

            if (
                raw.status_code in retry.retry_on_status
                and method_upper in retry.retry_methods
                and attempt < retry.max_attempts - 1
            ):
                if self._breaker is not None:
                    self._breaker.record_failure()
                delay = retry.compute_delay(attempt, previous_delay=delay)
                self._logger.debug(
                    "retrying on status",
                    status=raw.status_code,
                    attempt=attempt + 1,
                    delay_ms=int(delay * 1000),
                )
                await raw.aclose()
                await asyncio.sleep(delay)
                continue

            if self._breaker is not None:
                self._breaker.record_success()
            return Response(raw)

        # Unreachable in practice: the loop always returns a Response or
        # raises on the last attempt. Kept as a type-narrowing fallback.
        assert last_exc is not None  # pragma: no cover
        raise last_exc  # pragma: no cover

    # ---- convenience verbs --------------------------------------------------

    async def get(self, url: str, **kwargs: Any) -> Response:
        return await self.request("GET", url, **kwargs)

    async def head(self, url: str, **kwargs: Any) -> Response:
        return await self.request("HEAD", url, **kwargs)

    async def options(self, url: str, **kwargs: Any) -> Response:
        return await self.request("OPTIONS", url, **kwargs)

    async def post(self, url: str, **kwargs: Any) -> Response:
        return await self.request("POST", url, **kwargs)

    async def put(self, url: str, **kwargs: Any) -> Response:
        return await self.request("PUT", url, **kwargs)

    async def patch(self, url: str, **kwargs: Any) -> Response:
        return await self.request("PATCH", url, **kwargs)

    async def delete(self, url: str, **kwargs: Any) -> Response:
        return await self.request("DELETE", url, **kwargs)


# =============================================================================
# Module-level convenience verbs — each spins up a short-lived client.
# =============================================================================


async def _one_off(method: str, url: str, **kwargs: Any) -> Response:
    async with AsyncClient() as client:
        return await client.request(method, url, **kwargs)


async def get(url: str, **kwargs: Any) -> Response:
    return await _one_off("GET", url, **kwargs)


async def head(url: str, **kwargs: Any) -> Response:
    return await _one_off("HEAD", url, **kwargs)


async def options(url: str, **kwargs: Any) -> Response:
    return await _one_off("OPTIONS", url, **kwargs)


async def post(url: str, **kwargs: Any) -> Response:
    return await _one_off("POST", url, **kwargs)


async def put(url: str, **kwargs: Any) -> Response:
    return await _one_off("PUT", url, **kwargs)


async def patch(url: str, **kwargs: Any) -> Response:
    return await _one_off("PATCH", url, **kwargs)


async def delete(url: str, **kwargs: Any) -> Response:
    return await _one_off("DELETE", url, **kwargs)


# =============================================================================
# Consumer factory — LLM-tuned defaults.
# =============================================================================


DEFAULT_LLM_TIMEOUT = Timeout(connect=5.0, read=120.0, write=30.0, pool=5.0)


def fetch_httpx_async(
    *,
    base_url: str = "",
    auth: Any = None,
    headers: Mapping[str, str] | None = None,
    timeout: Timeout | float | dict | None = None,
    proxy: Proxy | dict | str | None = None,
    follow_redirects: bool = True,
    http2: bool = False,
    **extra: Any,
) -> AsyncClient:
    """Factory mirroring the consumer `fetch_httpx_async` defaults.

    Defaults bias toward LLM-call workloads: 120s read budget, redirect
    following on, HTTP/1.1 only (no http2 preflight). Extra kwargs forward
    to `AsyncClient`.
    """
    return AsyncClient(
        base_url=base_url,
        auth=auth,
        headers=headers,
        timeout=timeout if timeout is not None else DEFAULT_LLM_TIMEOUT,
        proxy=proxy,
        follow_redirects=follow_redirects,
        http2=http2,
        **extra,
    )


# =============================================================================
# CachingClient — wraps AsyncClient, short-circuits on hit.
# =============================================================================


class CachingClient:
    """Wrap an `AsyncClient` with an in-memory response cache.

    Only caches methods listed in `CacheConfig.methods` (GET/HEAD by default).
    Stats live on `self.cache.stats()`.
    """

    def __init__(
        self,
        client: AsyncClient,
        *,
        config: CacheConfig | None = None,
    ) -> None:
        self._client = client
        self.cache = CacheManager(
            config=config or CacheConfig(),
            storage=MemoryStorage(max_entries=(config or CacheConfig()).max_entries),
        )

    async def request(self, method: str, url: str, **kwargs: Any) -> Response:
        cfg = self.cache.config
        method_upper = method.upper()
        key_url = url
        if cfg.is_cacheable(method_upper):
            hit = await self.cache.get(method_upper, key_url, kwargs.get("headers"))
            if hit is not None:
                raw = httpx.Response(
                    status_code=hit.status,
                    headers=hit.headers,
                    content=hit.body,
                    request=httpx.Request(method_upper, url),
                )
                return Response(raw)

        resp = await self._client.request(method, url, **kwargs)
        if cfg.is_cacheable(method_upper, status=resp.status_code):
            await self.cache.put(
                method_upper,
                key_url,
                status=resp.status_code,
                response_headers=dict(resp.headers),
                body=resp.content,
                request_headers=kwargs.get("headers"),
            )
        return resp

    async def get(self, url: str, **kwargs: Any) -> Response:
        return await self.request("GET", url, **kwargs)

    async def head(self, url: str, **kwargs: Any) -> Response:
        return await self.request("HEAD", url, **kwargs)

    async def post(self, url: str, **kwargs: Any) -> Response:
        return await self.request("POST", url, **kwargs)

    async def put(self, url: str, **kwargs: Any) -> Response:
        return await self.request("PUT", url, **kwargs)

    async def patch(self, url: str, **kwargs: Any) -> Response:
        return await self.request("PATCH", url, **kwargs)

    async def delete(self, url: str, **kwargs: Any) -> Response:
        return await self.request("DELETE", url, **kwargs)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> CachingClient:
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        await self.aclose()


__all__ = [
    "DEFAULT_LLM_TIMEOUT",
    "AsyncClient",
    "CachingClient",
    "Response",
    "delete",
    "fetch_httpx_async",
    "get",
    "head",
    "options",
    "patch",
    "post",
    "put",
]

# Avoid circular import at type-check time.
__all__.extend(["HTTPError", "JitterStrategy"])
