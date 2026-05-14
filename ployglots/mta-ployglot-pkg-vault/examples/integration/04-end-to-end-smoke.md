# Integration Scenario 04 — End-to-End Smoke

## Goal

Single bash script that boots both servers with the polyglot vault-file
package installed, hits `/healthz`, and tears down. The ultimate "does the
package work when real consumers adopt it" check.

## Fixture

`fixtures/smoke-e2e.sh` — one script, two checks, idempotent teardown.

## Flow

```bash
chmod +x examples/integration/fixtures/smoke-e2e.sh
./examples/integration/fixtures/smoke-e2e.sh
```

The script:

1. Verifies both sibling repos exist (`mta-ployglot-server-bootstrap`,
   `mta-ployglot-server`); exits 0 with `[skipped]` if either is missing.
2. Links `@polyglot/vault-file` into `fastify_server` and installs the py
   twin editable into `fastapi_server`.
3. `make docker` in the runtime repo — boots both services.
4. `curl --fail -sS` against `/healthz` on ports 5100 and 5200.
5. `make down` in the runtime repo.

## Exit codes

| Code | Meaning                                                                       |
| ---- | ----------------------------------------------------------------------------- |
| 0    | Both healthz probes succeeded, or either sibling repo missing (skipped).      |
| 1+   | Docker boot failed, `/healthz` non-200, or teardown errored.                  |

## Environment overrides

- `BOOTSTRAP_REPO` — defaults to `/Users/Shared/autoload/mta-ployglot-server-bootstrap`.
- `RUNTIME_REPO` — defaults to `/Users/Shared/autoload/mta-ployglot-server`.

## Notes

- The script uses `set -euo pipefail`; any single failing step stops the
  run.
- Teardown runs only on the happy path — if a curl fails, the compose stack
  remains up so operators can inspect it. Re-run `make down` manually when
  done.
