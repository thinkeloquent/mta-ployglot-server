"""polyglot-fetch-http-client — async HTTP client on top of httpx.

Python twin of `@polyglot/fetch-http-client`. Provides a single
`AsyncClient` with typed auth (Basic/Bearer/APIKey/Digest), timeout /
limits / proxy normalisation, retry with jitter, circuit-breaker,
event hooks, a structured logger, a 30-class exception hierarchy, and
an optional in-memory response cache.

Quick start
-----------

    import asyncio
    from fetch_http_client import AsyncClient, BasicAuth

    async def main():
        async with AsyncClient(
            base_url="https://api.example.com",
            auth=BasicAuth("user", "pass"),
        ) as client:
            r = await client.get("/ping")
            r.raise_for_status()
            print(r.json())

    asyncio.run(main())

Proxy convention
----------------

    from fetch_http_client import AsyncClient, Proxy

    # explicit URL
    AsyncClient(proxy=Proxy(url="http://corp:3128"))

    # empty dict == auto-detect from HTTPS_PROXY / HTTP_PROXY env vars
    AsyncClient(proxy={})

Environment variables
---------------------
    LOG_LEVEL          TRACE | DEBUG | INFO | WARN | ERROR | SILENT (default INFO)
    LOG_FORMAT         json | pretty                                 (default pretty in dev)
    PYTHON_ENV         development | production
    HTTPS_PROXY        outbound HTTPS proxy
    HTTP_PROXY         outbound HTTP proxy
    NO_PROXY           comma-separated host rules to bypass the proxy
"""

from ._auth import (
    APIKeyAuth,
    Auth,
    BasicAuth,
    BearerAuth,
    DigestAuth,
    build_auth,
)
from ._cache import (
    CacheConfig,
    CacheEntry,
    CacheEntryMetadata,
    CacheManager,
    CacheStats,
    CacheStorage,
    MemoryStorage,
    RequestCacheOptions,
    cached,
    combine_key_strategies,
    create_hashed_key_strategy,
    default_key_strategy,
)
from ._client import (
    DEFAULT_LLM_TIMEOUT,
    AsyncClient,
    CachingClient,
    Response,
    delete,
    fetch_httpx_async,
    get,
    head,
    options,
    patch,
    post,
    put,
)
from ._config import (
    DEFAULT_LIMITS,
    DEFAULT_TIMEOUT,
    Limits,
    Proxy,
    ProxyAuth,
    Timeout,
    get_proxy_from_env,
    should_bypass_proxy,
)
from ._exceptions import (
    AuthError,
    CacheError,
    CacheKeyError,
    CacheStorageError,
    CircuitOpenError,
    CloseError,
    ConnectError,
    ConnectTimeout,
    CookieConflict,
    DecodingError,
    HTTPError,
    HTTPStatusError,
    InvalidURL,
    LocalProtocolError,
    NetworkError,
    PoolTimeout,
    ProtocolError,
    ProxyError,
    ReadError,
    ReadTimeout,
    RemoteProtocolError,
    RequestError,
    RequestNotRead,
    ResponseNotRead,
    StreamClosed,
    StreamConsumed,
    StreamError,
    TimeoutException,
    TooManyRedirects,
    TransportError,
    UnsupportedProtocol,
    WriteError,
    WriteTimeout,
    map_exception,
)
from ._logger import Logger, LogLevel, create_logger
from ._retry import (
    DEFAULT_RETRY_STATUS,
    IDEMPOTENT_METHODS,
    SAFE_METHODS,
    CircuitBreaker,
    CircuitBreakerConfig,
    CircuitState,
    JitterStrategy,
    RetryConfig,
)
from ._version import __version__

__all__ = [
    "DEFAULT_LIMITS",
    "DEFAULT_LLM_TIMEOUT",
    "DEFAULT_RETRY_STATUS",
    "DEFAULT_TIMEOUT",
    "IDEMPOTENT_METHODS",
    "SAFE_METHODS",
    "APIKeyAuth",
    "AsyncClient",
    "Auth",
    "AuthError",
    "BasicAuth",
    "BearerAuth",
    "CacheConfig",
    "CacheEntry",
    "CacheEntryMetadata",
    "CacheError",
    "CacheKeyError",
    "CacheManager",
    "CacheStats",
    "CacheStorage",
    "CacheStorageError",
    "CachingClient",
    "CircuitBreaker",
    "CircuitBreakerConfig",
    "CircuitOpenError",
    "CircuitState",
    "CloseError",
    "ConnectError",
    "ConnectTimeout",
    "CookieConflict",
    "DecodingError",
    "DigestAuth",
    "HTTPError",
    "HTTPStatusError",
    "InvalidURL",
    "JitterStrategy",
    "Limits",
    "LocalProtocolError",
    "LogLevel",
    "Logger",
    "MemoryStorage",
    "NetworkError",
    "PoolTimeout",
    "ProtocolError",
    "Proxy",
    "ProxyAuth",
    "ProxyError",
    "ReadError",
    "ReadTimeout",
    "RemoteProtocolError",
    "RequestCacheOptions",
    "RequestError",
    "RequestNotRead",
    "Response",
    "ResponseNotRead",
    "RetryConfig",
    "StreamClosed",
    "StreamConsumed",
    "StreamError",
    "Timeout",
    "TimeoutException",
    "TooManyRedirects",
    "TransportError",
    "UnsupportedProtocol",
    "WriteError",
    "WriteTimeout",
    "__version__",
    "build_auth",
    "cached",
    "combine_key_strategies",
    "create_hashed_key_strategy",
    "create_logger",
    "default_key_strategy",
    "delete",
    "fetch_httpx_async",
    "get",
    "get_proxy_from_env",
    "head",
    "map_exception",
    "options",
    "patch",
    "post",
    "put",
    "should_bypass_proxy",
]
