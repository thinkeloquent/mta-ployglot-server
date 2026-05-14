# Integration Scenario 03 — Docker Compose Smoke

## Goal

Layer the polyglot vault-file package onto the `mta-ployglot-server`
runtime's Dockerfiles via a compose override, then boot both services and
hit `/healthz` to confirm the env store wiring.

## Fixtures

- `fixtures/compose.vault-file.yml` — override for
  `mta-ployglot-server/docker-compose.yml`.
- `fixtures/smoke-docker.sh` — boot / curl / down bash script.

## Flow

```bash
chmod +x examples/integration/fixtures/smoke-docker.sh
SERVER_REPO=/Users/Shared/autoload/mta-ployglot-server \
  ./examples/integration/fixtures/smoke-docker.sh
```

`smoke-docker.sh` exits 0 when:

1. `docker compose up --build --wait` succeeds on both services.
2. `GET /healthz` returns 200 on port 5100 (fastify) and 5200 (fastapi).
3. `docker compose down` succeeds.

When `$SERVER_REPO` does not exist, the script exits 0 with a `[skipped]`
marker — no false failures on workstations that don't have the runtime repo
cloned.

## Build args used

- `EXTRA_NPM="@polyglot/vault-file"` → installed in the fastify image.
- `EXTRA_PIP=polyglot-vault-file` → installed in the fastapi image.

Both args are consumed by the stock runtime Dockerfiles per
`mta-ployglot-server/README.md`.

## Consumer `.env.sample`

Drop a `.env.sample` next to the compose file with at least one non-empty
line; the volume mount exposes it at `/app/.env` inside both containers.

## Notes

- The runtime repo's Dockerfiles stage the `EXTRA_*` install layers late, so
  builds remain cache-friendly.
- No cross-repo modifications — this override is the entire integration
  surface on the consumer side.
