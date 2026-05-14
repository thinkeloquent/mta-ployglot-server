# `polyglot-fetch-http-client` (Python)

Async HTTP client on top of [`httpx`](https://www.python-httpx.org/) with
typed auth, retry + jitter, circuit breaker, in-memory response cache,
structured logger, and a 30-class exception hierarchy.

Python twin of the TypeScript package
[`@polyglot/fetch-http-client`](../ts/README.md) living in the same
polyglot workspace.

## Install

```bash
make -C packages/py install   # installs the package + dev extras (editable)
```

The package itself ships `httpx >= 0.27` as its only runtime dependency.

## Quickstart

```python
import asyncio
from fetch_http_client import AsyncClient, BasicAuth, Timeout

async def main():
    async with AsyncClient(
        base_url="https://api.example.com",
        auth=BasicAuth("user", "pass"),
        timeout=Timeout(connect=5.0, read=30.0),
    ) as client:
        resp = await client.get("/users/me")
        resp.raise_for_status()
        print(resp.json())

asyncio.run(main())
```

## Public surface

| Area                  | Symbols                                                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Client                | `AsyncClient`, `CachingClient`, `Response`, `fetch_httpx_async`, module-level verbs (`get`, `post`, …)                              |
| Auth                  | `Auth`, `BasicAuth`, `BearerAuth`, `APIKeyAuth`, `DigestAuth`, `build_auth`                                                         |
| Config                | `Timeout`, `Limits`, `Proxy`, `ProxyAuth`, `DEFAULT_TIMEOUT`, `DEFAULT_LIMITS`, `DEFAULT_LLM_TIMEOUT`, `get_proxy_from_env`, `should_bypass_proxy` |
| Retry & breaker       | `RetryConfig`, `JitterStrategy`, `CircuitBreaker`, `CircuitBreakerConfig`, `CircuitState`, `IDEMPOTENT_METHODS`, `SAFE_METHODS`      |
| Cache                 | `CacheConfig`, `CacheManager`, `CacheStorage`, `MemoryStorage`, `cached`, `combine_key_strategies`, `create_hashed_key_strategy`    |
| Logger                | `Logger`, `LogLevel`, `create_logger`                                                                                               |
| Exceptions            | `HTTPError` tree (30+ classes) — `ConnectError`, `ReadTimeout`, `ProxyError`, `HTTPStatusError`, `CircuitOpenError`, `AuthError`, … |

## Proxy

`Proxy` accepts a URL plus optional auth. Two shortcuts:

```python
# Explicit
from fetch_http_client import Proxy, ProxyAuth
client = AsyncClient(proxy=Proxy(url="http://corp:3128"))
client = AsyncClient(proxy=Proxy(url="http://corp:3128",
                                 auth=ProxyAuth("svc", "secret")))

# String shorthand
client = AsyncClient(proxy="http://corp:3128")

# Empty dict → auto-detect from HTTPS_PROXY / HTTP_PROXY env
client = AsyncClient(proxy={})
```

`NO_PROXY` (comma-separated hosts, wildcard `*`, suffix `.example.com`)
is honoured via `should_bypass_proxy(host)`.

## Retry policy

```python
from fetch_http_client import RetryConfig, JitterStrategy

retry = RetryConfig(
    max_attempts=5,
    base_delay=0.25,
    max_delay=30.0,
    multiplier=2.0,
    jitter=JitterStrategy.FULL,         # NONE | FULL | EQUAL | DECORRELATED
    retry_on_status={429, 500, 502, 503, 504},
)
client = AsyncClient(retry=retry)
```

Retries only fire for methods in `RetryConfig.retry_methods` — by
default the idempotent set (`GET`, `HEAD`, `OPTIONS`, `TRACE`, `PUT`,
`DELETE`). POST/PATCH never retry.

## Circuit breaker

```python
from fetch_http_client import CircuitBreaker, CircuitBreakerConfig

cb = CircuitBreaker(config=CircuitBreakerConfig(
    failure_threshold=5, recovery_timeout=30.0, success_threshold=2,
))
client = AsyncClient(circuit_breaker=cb)
```

Breaker trips to OPEN after `failure_threshold` consecutive failures,
short-circuits with `CircuitOpenError` for `recovery_timeout` seconds,
then advances to HALF_OPEN for a probing window.

## Cache

```python
from fetch_http_client import AsyncClient, CacheConfig, CachingClient

async with AsyncClient(base_url="https://x") as inner:
    async with CachingClient(inner, config=CacheConfig(ttl_seconds=60)) as client:
        await client.get("/thing")       # miss → set
        await client.get("/thing")       # hit
        print(client.cache.stats().as_dict())
```

Only `GET` and `HEAD` responses with status in
`{200, 203, 300, 301, 404, 410}` are cached (RFC 7234-ish).

## Event hooks

```python
async def on_req(req):  req.headers["x-request-id"] = "abc"
async def on_resp(resp): print(resp.status_code)

AsyncClient(on_request=[on_req], on_response=[on_resp])
```

## Logger

Structured logger with JSON/pretty formats, level filtering, header
redaction, and child contexts:

```python
from fetch_http_client import create_logger

log = create_logger("svc.api", request_id="abc")
log.info("sent", method="GET", url="/ping")
kid = log.child(user_id=42)
kid.warn("slow response", duration_ms=910)
```

Driven by `LOG_LEVEL` (`TRACE|DEBUG|INFO|WARN|ERROR|SILENT`), `LOG_FORMAT`
(`json|pretty`), and `PYTHON_ENV` (`development|production`).

## Layout

```
packages/py/
├── pyproject.toml
├── Makefile
├── README.md
├── fetch_http_client/           # library (installed as polyglot-fetch-http-client)
│   ├── __init__.py              # barrel re-exports
│   ├── _auth.py
│   ├── _cache.py
│   ├── _client.py
│   ├── _config.py
│   ├── _exceptions.py
│   ├── _logger.py
│   ├── _retry.py
│   ├── _version.py
│   └── py.typed
├── examples/
│   ├── _shared.py               # require_env + build_proxy helpers
│   ├── api/                     # 3 AsyncClient scenarios
│   ├── sdk/                     # 2 fetch_httpx_async scenarios
│   ├── cli/                     # shell wrapper around module-level verbs
│   └── integrations/            # JIRA | Confluence | GitHub | Figma | Statsig | Sauce Labs
└── tests/
    ├── test_auth.py
    ├── test_cache.py
    ├── test_caching_client.py
    ├── test_client.py
    ├── test_config.py
    ├── test_exceptions.py
    ├── test_integrations.py
    ├── test_logger.py
    ├── test_retry.py
    ├── test_shared.py
    └── integration/
        ├── README.md
        ├── test_http_smoke.py
        └── test_live_providers.py
```

## Make targets

| Target              | Description                                            |
| ------------------- | ------------------------------------------------------ |
| `make help`         | List all targets                                       |
| `make install`      | Editable install with dev extras                       |
| `make ci-install`   | CI-flavoured install (same contract)                   |
| `make test`         | Unit tests (skips `tests/integration/`)                |
| `make test-integration` | Integration suite (env-gated + network)            |
| `make test-watch`   | Watch mode                                             |
| `make lint`         | `ruff check` + `ruff format --check`                   |
| `make format`       | `ruff format` + `ruff check --fix`                     |
| `make build`        | `python -m build` → wheel + sdist under `dist/`        |
| `make clean`        | Remove caches + build artefacts                        |
| `make distclean`    | `clean` + remove `.venv`                               |
| `make ci`           | `ci-install` → `lint` → `test`                         |

## Examples — integrations

See [`examples/README.md`](examples/README.md) for the full env contract.
Each of the six provider examples follows the same shape:

```bash
JIRA_HOST=https://acme.atlassian.net \
JIRA_USER=you@acme.com \
JIRA_PASS="$(pass jira-token)" \
python -m examples.integrations.jira
```

Provider matrix (HOST/USER/PASS → endpoint exercised):

| Service     | Auth                         | Endpoint                                       |
| ----------- | ---------------------------- | ---------------------------------------------- |
| JIRA        | Basic (email + API token)    | `GET /rest/api/3/myself`                       |
| Confluence  | Basic (email + API token)    | `GET /api/v2/spaces?limit=5`                   |
| GitHub      | Bearer (PAT)                 | `GET /user`                                    |
| Figma       | `X-Figma-Token` header       | `GET /v1/me`                                   |
| Statsig     | `STATSIG-API-KEY` header     | `GET /console/v1/feature_gates`                |
| Sauce Labs  | Basic (username + access)    | `GET /rest/v1/users/{user}/concurrency`        |

The examples also demonstrate the **`proxy={}` placeholder** convention:

```python
proxy = build_proxy({})          # auto-detect from HTTPS_PROXY / HTTP_PROXY
proxy = build_proxy({"host": "http://corp:3128", "user": "u", "pass": "p"})
kwargs = {"base_url": host, "auth": BasicAuth(u, p)}
if proxy is not None:
    kwargs["proxy"] = proxy
async with AsyncClient(**kwargs) as client:
    ...
```

## Relation to the TypeScript twin

The Python package intentionally mirrors the TypeScript surface in
structure, naming, and default values. Key points of parity:

- Same auth class names (`BasicAuth`, `BearerAuth`, `APIKeyAuth`, `DigestAuth`).
- Same `Timeout` phases (connect/read/write/pool) and `DEFAULT_LLM_TIMEOUT`.
- Same retry + jitter strategies (`NONE`/`FULL`/`EQUAL`/`DECORRELATED`).
- Same circuit-breaker state names (`CLOSED`/`OPEN`/`HALF_OPEN`).
- Same integrations (JIRA, Confluence, GitHub, Figma, Statsig, Sauce Labs)
  with the same `<SERVICE>_HOST/USER/PASS` env contract and the same
  `proxy={}` auto-detect convention.

Drift that **is** intentional:

- Case: Python uses `snake_case` (`raise_for_status`, `follow_redirects`),
  TS uses `camelCase`.
- No sync `Client` (TS has no sync idiom either; both are async-only).
- Streaming primitives deferred — current `Response` reads the full body.
- FastAPI integration deferred (plan feature 13) — the TS twin will ship
  a Fastify adapter; the Python side's FastAPI adapter will land in a
  follow-up.

## Response status fields

| Field          | Type | Description                                         |
| -------------- | ---- | --------------------------------------------------- |
| `status_code`  | int  | HTTP status code.                                   |
| `status`       | str  | Textual reason phrase (e.g. `"OK"`, `"Not Found"`). |

> ⚠️ `Response.status` is the TEXT here — opposite of the Web Fetch API where
> `Response.status` is the integer. Use `status_code` when you need the integer.
