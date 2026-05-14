# Examples

Runnable examples for `polyglot-figma-api`. Every example reads:

| Var              | Purpose                                                     |
| ---------------- | ----------------------------------------------------------- |
| `FIGMA_HOST`     | Optional host override (default `https://api.figma.com`).   |
| `FIGMA_USER`     | Placeholder — Figma is token-only. Kept for ENV symmetry.   |
| `FIGMA_PASS`     | **Required.** Figma Personal Access Token.                  |
| `FIGMA_FILE_KEY` | Optional file key for file-reading examples.                |
| `HTTPS_PROXY`    | Optional outbound proxy (auto-detected by `proxy = {}`).    |
| `HTTP_PROXY_USER`/`PASS` | Optional proxy credentials.                        |

```bash
# From packages/py/ (inside the uv venv, or with `uv run`):
FIGMA_PASS=$YOUR_TOKEN uv run python -m examples.sdk.basic_usage
FIGMA_PASS=$YOUR_TOKEN uv run python -m examples.sdk.with_proxy auto
FIGMA_PASS=$YOUR_TOKEN uv run python -m examples.sdk.byo_fetch_client

FIGMA_PASS=$YOUR_TOKEN ./examples/cli/01_whoami.sh

uv run python -m examples.api.create_figma_client   # no network
```

## Proxy modes

All three modes of the `proxy = {}` contract are shown in
[`sdk/with_proxy.py`](sdk/with_proxy.py):

| Mode     | Argv       | What happens                                             |
| -------- | ---------- | -------------------------------------------------------- |
| auto     | `auto`     | Auto-detect from `HTTPS_PROXY` / `HTTP_PROXY` env.       |
| explicit | `explicit` | Use `HTTPS_PROXY` as the explicit host (no env fallback).|
| full     | `full`     | Send host + `HTTP_PROXY_USER` + `HTTP_PROXY_PASS`.       |

When no proxy is discoverable, the helper returns `None` and the
underlying fetch client is constructed without a `proxy=` kwarg —
passing `proxy = {}` is always safe.
