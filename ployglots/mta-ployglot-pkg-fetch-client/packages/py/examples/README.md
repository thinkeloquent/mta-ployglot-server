# `polyglot-fetch-http-client` Examples

Runnable Python examples for the package. Each file under `api/`, `sdk/`,
`cli/`, and `integrations/` is self-contained.

Install the package first (examples import from the installed
distribution, not a source path):

```bash
make -C packages/py install
```

## Layout

```
examples/
├── _shared.py                              # require_env + build_proxy helpers
├── api/
│   ├── 01_create_async_client.py           # tuned AsyncClient defaults
│   ├── 02_client_verb_methods.py           # client.get / client.post + .json()
│   └── 03_event_hooks.py                   # on_request / on_response hooks
├── sdk/
│   ├── 01_basic_get.py                     # fetch_httpx_async end-to-end
│   └── 02_caching_client.py                # CachingClient with stats()
├── cli/
│   └── 01-one-off-request.sh               # module-level `get(...)` from bash
└── integrations/
    ├── jira.py           # JIRA REST v3            — Basic auth (email + API token)
    ├── confluence.py     # Confluence Cloud v2     — Basic auth (email + API token)
    ├── github.py         # GitHub REST             — Bearer (PAT)
    ├── figma.py          # Figma REST              — X-Figma-Token header
    ├── statsig.py        # Statsig Console API     — STATSIG-API-KEY header
    └── saucelabs.py      # Sauce Labs              — Basic auth (username + access key)
```

## Index

| Area | File                                             | Illustrates                                                                    |
| ---- | ------------------------------------------------ | ------------------------------------------------------------------------------ |
| api  | `api/01_create_async_client.py`                  | `AsyncClient` with Timeout, BearerAuth, RetryConfig + full jitter.             |
| api  | `api/02_client_verb_methods.py`                  | `client.get` / `client.post` with params, JSON body, `.json()`.                |
| api  | `api/03_event_hooks.py`                          | `on_request` / `on_response` hooks for request-id + timing.                    |
| sdk  | `sdk/01_basic_get.py`                            | `fetch_httpx_async` factory — LLM-tuned defaults, zero auth.                   |
| sdk  | `sdk/02_caching_client.py`                       | `CachingClient` — second call from memory, `.cache.stats()` reports.           |
| cli  | `cli/01-one-off-request.sh`                      | Shell wrapper around module-level `get(...)`.                                  |
| int  | `integrations/jira.py`                           | JIRA REST API v3 — Basic auth + optional proxy.                                |
| int  | `integrations/confluence.py`                     | Confluence Cloud v2 — Basic auth + optional proxy.                             |
| int  | `integrations/github.py`                         | GitHub REST — Bearer PAT + optional proxy.                                     |
| int  | `integrations/figma.py`                          | Figma — `X-Figma-Token` header + optional proxy.                               |
| int  | `integrations/statsig.py`                        | Statsig Console API — `STATSIG-API-KEY` header + optional proxy.               |
| int  | `integrations/saucelabs.py`                      | Sauce Labs — Basic auth (username + access key) + optional proxy.              |

## Env-var convention (integrations)

Every integration accepts `<SERVICE>_HOST`, `<SERVICE>_USER`, `<SERVICE>_PASS`
(plus the standard proxy env vars). Examples that don't use a username
(Figma, Statsig, GitHub) still accept `<SERVICE>_USER` for symmetry; it's
read with `optional_env(...)` and ignored.

| Service    | HOST                                              | USER             | PASS                  |
| ---------- | ------------------------------------------------- | ---------------- | --------------------- |
| JIRA       | `https://<your-domain>.atlassian.net`             | Atlassian email  | JIRA API token        |
| Confluence | `https://<your-domain>.atlassian.net/wiki`        | Atlassian email  | Confluence API token  |
| GitHub     | `https://api.github.com` (or your GHE host)       | username (any)   | GitHub PAT            |
| Figma      | `https://api.figma.com`                           | (unused)         | Figma PAT             |
| Statsig    | `https://statsigapi.net`                          | (unused)         | Console API key       |
| Sauce Labs | `https://api.<region>.saucelabs.com`              | Sauce username   | Sauce access key      |

## Optional proxy (`proxy={}`)

Every integration example calls `build_proxy({})` from `_shared.py`.
The empty dict means **"auto-detect from `HTTPS_PROXY` / `HTTP_PROXY`"**.
Pass `{"host": ..., "user": ..., "pass": ...}` to override explicitly.
When `build_proxy(...)` returns `None`, the example omits the `proxy=`
kwarg on the client:

```python
proxy = build_proxy({})
kwargs: dict = { "base_url": host, "auth": BasicAuth(user, pw) }
if proxy is not None:
    kwargs["proxy"] = proxy
async with AsyncClient(**kwargs) as client:
    ...
```

Explicit override:

```python
from examples._shared import build_proxy

proxy = build_proxy({
    "host": "http://corp-proxy.internal:3128",
    "user": "svc-account",
    "pass": os.environ["PROXY_SECRET"],
})
```

## Running an example

```bash
JIRA_HOST=https://acme.atlassian.net \
JIRA_USER=you@acme.com \
JIRA_PASS="$(pass jira-token)" \
python -m examples.integrations.jira
```

Or route through a proxy:

```bash
HTTPS_PROXY=http://corp-proxy.internal:3128 \
GITHUB_PASS="$(pass github-pat)" \
python -m examples.integrations.github
```

## Offline smoke testing

Point `<SERVICE>_HOST` at a local mock:

```bash
python -c "
import http.server, socketserver
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200); self.send_header('content-type','application/json')
        self.end_headers(); self.wfile.write(b'{\"ok\":true}')
socketserver.TCPServer(('', 3000), H).serve_forever()
" &
JIRA_HOST=http://localhost:3000 JIRA_USER=x JIRA_PASS=x \
  python -m examples.integrations.jira
```

## Integration tests

End-to-end tests that hit live providers live under `tests/integration/`.
They share the same env-var contract and are skipped when the required
env vars are missing — run with:

```bash
make -C packages/py test-integration
```
