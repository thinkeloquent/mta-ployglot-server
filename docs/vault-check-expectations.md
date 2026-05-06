# vault-check — Expected Behavior in Dev Shells

The `make vault-check` gate (defined in `Makefile.gates:30–37`, source helpers
under `scripts/workspace/orchestrator/`) iterates every env key referenced by
`server/fastify` and `server/fastapi` and probes whether each key is set in the
current shell. It exits non-zero when **any** key is unset.

## Expected: vault-check FAILS in an unconfigured dev shell

The gate is strict by default: a partial environment in production would silently
break route handlers that read `process.env.X` / `os.environ["X"]`. So the gate
does not fall back to defaults.

In a fresh local shell with no `.env*` sourced, expect ~17 of 18 keys to report
`FAIL`. Only `APP_ENV` is typically set (by the parent shell or `make` itself).

This is **correct gate behavior** — the gate is reporting the dev shell, not a
code defect.

## Three modes, summarized

| Invocation | Behavior on missing keys | Use case |
|---|---|---|
| `make vault-check` (default) | Exit 1 with helpful remediation | Safe default; matches CI |
| `VAULT_CHECK=warn make vault-check` | Exit 0, prints `WARN` lines | Dev shell where keys are intentionally unprovisioned |
| `CI=1 [...] make vault-check` | Exit 1 even if `VAULT_CHECK=warn` | CI runners — opt-out is ignored |

Rule: `CI=1` always wins over `VAULT_CHECK=warn` so an opt-out smuggled via env-var into CI does not silently degrade the gate.

## When vault-check should pass

- **CI runners** — secrets injected by the workflow's `env:` block; gate must
  pass before `pre-push` proceeds.
- **Production-like local shells** — operator has sourced a `.env.<profile>`
  file that supplies every key referenced by the addons.
- **Pre-merge validation** — before merging a release branch, run vault-check
  against a staging-equivalent secret set to confirm no addon was added that
  references an unprovisioned key.

## How to satisfy vault-check locally

Two supported patterns:

1. **One-shot, scoped to a single make invocation:**

   ```sh
   set -a; source .env.dev; set +a
   make vault-check
   ```

2. **Per-shell, durable:**

   Source a profile file in your shell rc (`~/.zshrc`, `~/.bashrc`). Replace
   `<repo-path>` with the absolute path to your local clone of this repo:

   ```sh
   [ -f <repo-path>/.env.dev ] && \
     set -a && source <repo-path>/.env.dev && set +a
   ```

   The repo does not commit a `.env.dev` — request one from the team's secret
   store or generate placeholder values for local-only addons.

## How to know which keys are required

```sh
scripts/workspace/orchestrator/extract-vault-keys.sh --twin both --json | jq -r .key | sort -u
```

The list is derived from `process.env.*` / `os.environ.*` references in
`server/{fastify,fastapi}/config/{environment,lifecycles,routes}/`.

## How vault-check fits into pre-push

`make pre-push` (see `Makefile.gates:183–191`) runs vault-check as gate #2 of 8
and stops on first failure unless `KEEP_GOING=1`. CI workflows that need a
hard-fail on missing secrets should run `make pre-push` *without* `KEEP_GOING`.
A local dev iteration that wants to skip the gate temporarily can
`make pre-push KEEP_GOING=1` and inspect the rest of the gates.

## Related

- Source: `scripts/workspace/orchestrator/extract-vault-keys.sh`,
  `scripts/workspace/orchestrator/probes/vault-probe.{mjs,py}`
- JSON variant: `make vault-check-json` emits `{"key":"X","twins":[...],"ok":bool}`
- Documented deviation #1 in `scripts/workspace/orchestrator/README.md`:
  the orchestrator probes `process.env` / `os.environ` directly rather than
  `vault.get()` because the probes run outside the Fastify/FastAPI runtime
  where `EnvStore` lives.
