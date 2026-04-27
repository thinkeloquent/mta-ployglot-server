# Build Matrix

Per-language toolchains, lockfile state, and how each app's deps are sourced.

## Toolchains

| Axis              | `mta-fastify-server` (mjs)              | `mta-fastapi-server` (py)                       |
|-------------------|-----------------------------------------|-------------------------------------------------|
| Runtime           | Node ≥ 20                               | Python ≥ 3.11                                   |
| Package manager   | `npm`                                   | `pip` (poetry manifest, but installed via pip)  |
| Manifest file     | `server/fastify/package.json`           | `server/fastapi/pyproject.toml`                 |
| Lockfile          | `server/fastify/package-lock.json`      | none at this layer (host-direct `.venv`)        |
| Virtual env dir   | `node_modules/`                         | `.venv/`                                        |
| Entry script      | `main.mjs`                              | `main.py` (uvicorn)                             |

## Install flow

### Local host-direct (`make dev`)

| Step              | mjs twin                                                       | py twin                                                                  |
|-------------------|----------------------------------------------------------------|--------------------------------------------------------------------------|
| Pre-req check     | Root `Makefile` `dev-preflight` verifies `node`, `npm`, `uv`   | same target                                                              |
| Install command   | `cd server/fastify && npm install`                             | `pip install -e` against sibling-symlinked paths into `.venv/`           |
| Source staging    | Submodule mutated in-place is OK — `file:` dep reads from there | Submodule mutated in-place is OK — editable install reads from there    |

### Docker (`make build && make up`)

| Step              | mjs twin                                           | py twin                                           |
|-------------------|----------------------------------------------------|---------------------------------------------------|
| Dockerfile        | `server/fastify/Dockerfile`                        | `server/fastapi/Dockerfile`                       |
| Base image        | `node:<pinned-digest>`                             | `python:<pinned-digest>`                          |
| Non-root user     | `node`                                             | `app`                                             |
| PID 1             | `tini`                                             | `--init`                                          |
| Port exposed      | `3000`                                             | `8080`                                            |
| Host port mapping | `FASTIFY_PORT` (default `5100`) → 3000             | `FASTAPI_PORT` (default `5200`) → 8080            |

## Dependency sourcing

Both apps depend on **in-repo + sibling-repo** code, not registry packages, for the bootstrap layer.

| Dep                                  | Source                                                                                 | Resolution |
|--------------------------------------|----------------------------------------------------------------------------------------|------------|
| `fastify-server` / `thinkeloquent-fastapi-server` | `ployglots/mta-ployglot-server-bootstrap/` (sibling-repo symlink)           | `file:`/`path:` |
| `@mta/print-routes-fastify` / `print-routes-fastapi` | `../mta-ployglot-server-print-routes/` (sibling)      | `file:`/`path:` |
| `@polyglot/fetch-http-client` / `polyglot-fetch-http-client` | `../mta-ployglot-pkg-fetch-client/` (sibling) | `file:`/`path:` *(once the active integration work lands)* |

Implication: this repo is **not** self-contained. A fresh clone needs every sibling repo cloned next to it (under the shared parent dir) so the `ployglots/` symlinks resolve. The root `Makefile` `dev-preflight` target aborts early with a clone hint if any are missing. `make bootstrap` clones any missing siblings and lays the symlinks.

## Dev-mode staging (`.dev/`)

The root `Makefile`'s host-direct dev mode stages copies of sibling repos (reached via the `ployglots/` symlinks) under `.dev/{fastify,fastapi,fastify-app}/` so installs don't mutate read-only sibling state. `.dev/` is gitignored. Staging writes happen only once per `make install-node` / `make install-python` invocation.

## CI

Two GitHub Actions workflows ship in-repo (PR-driven release flow):

| Workflow                                             | Trigger                                                | Effect                                                                                    |
|------------------------------------------------------|--------------------------------------------------------|-------------------------------------------------------------------------------------------|
| `.github/workflows/release-preflight-on-pr.yml`      | PR open/sync/reopen targeting `release/**`             | runs `make release-preflight REF=<base>` (root + every sibling); blocks merge on failure  |
| `.github/workflows/release-assemble-on-pr-merge.yml` | PR `closed` with `merged == true` against `release/**` | hydrate → subtree-pull at HEAD → emit manifest → commit atomically → push → comment on PR |

Local CI entry points:

- `make ci` — root target, runs `ci-install lint test build` against the docker compose stack.
- `make ci-local` — full local pipeline (doctor → projections-check → subtree-lint → ci-install → lint → test → build).
- `make -C server/fastify ci` / `make -C server/fastapi ci` — per-package CI (both Makefiles will be installed as part of the active `integrate-fetch-client` work; currently the per-package Makefiles are thin).
- `make -C packages/orchestrator ci` — orchestrator package CI (subtree-lint + bats + emitter idempotency + doctor).

## Where things can break

- **Submodule not initialized** → `fastify-server` / `thinkeloquent-fastapi-server` don't resolve. Fix: `make init`.
- **Sibling repo missing** → `@mta/print-routes-fastify` fails to resolve during `npm install`. Fix: `git clone` the sibling at the expected path (see `Makefile` `FETCH_CLIENT_DIR` / `PRINT_ROUTES_DIR`).
- **Stale `dist/` in a TS sibling** → typed imports fail. Fix: `make -C <sibling>/packages/ts build` before the install.
- **Port already bound** → both compose and host-direct modes surface as "address in use". The host-direct mode writes the PID to `.dev/<name>.pid` so `make dev-stop` kills cleanly.
