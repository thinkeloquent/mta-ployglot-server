# Examples

Runnable examples for `@polyglot/figma-api`. Every example reads:

| Var                      | Purpose                                                   |
| ------------------------ | --------------------------------------------------------- |
| `FIGMA_HOST`             | Optional host override (default `https://api.figma.com`). |
| `FIGMA_USER`             | Placeholder — Figma is token-only. Kept for ENV symmetry. |
| `FIGMA_PASS`             | **Required.** Figma Personal Access Token.                |
| `FIGMA_FILE_KEY`         | Optional file key for file-reading examples.              |
| `HTTPS_PROXY`            | Optional outbound proxy (auto-detected by `proxy = {}`).  |
| `HTTP_PROXY_USER`/`PASS` | Optional proxy credentials.                               |

```bash
# From packages/ts/:
FIGMA_PASS=$YOUR_TOKEN npx tsx examples/sdk/01-basic-usage.ts
FIGMA_PASS=$YOUR_TOKEN npx tsx examples/sdk/02-with-proxy.ts auto
FIGMA_PASS=$YOUR_TOKEN npx tsx examples/sdk/03-byo-fetch-client.ts

FIGMA_PASS=$YOUR_TOKEN ./examples/cli/01-whoami.sh
FIGMA_PASS=$YOUR_TOKEN ./examples/cli/02-get-file.sh <file-key>

npx tsx examples/api/01-create-figma-client.ts    # no network
```

## Proxy modes

All three modes of the `proxy = {}` contract are shown in
[`sdk/02-with-proxy.ts`](sdk/02-with-proxy.ts):

| Mode     | Argv       | What happens                                              |
| -------- | ---------- | --------------------------------------------------------- |
| auto     | `auto`     | Auto-detect from `HTTPS_PROXY` / `HTTP_PROXY` env.        |
| explicit | `explicit` | Use `HTTPS_PROXY` as the explicit host (no env fallback). |
| full     | `full`     | Send host + `HTTP_PROXY_USER` + `HTTP_PROXY_PASS`.        |

When no proxy is discoverable the helper returns `undefined` and the
underlying fetch client is constructed without a `proxy:` field — so
passing `proxy = {}` is always safe.
