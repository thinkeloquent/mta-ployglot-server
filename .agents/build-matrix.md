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

Both apps depend on **in-repo + sibling-repo** code, not registry packages, for the bootstrap and lifecycle layers. Every entry below is reached through a `ployglots/` symlink (laid by `scripts/workspace/bootstrap.sh`) or a parent-relative `../` path, never via a registry.

| Dep family                                                                    | mjs name                              | py name                          | Sibling repo                                  | Lifecycle slot |
|-------------------------------------------------------------------------------|---------------------------------------|----------------------------------|------------------------------------------------|----------------|
| Bootstrap (addon orchestrator)                                                | `fastify-server`                      | `thinkeloquent-fastapi-server`   | `mta-ployglot-server-bootstrap`               | n/a (boot)     |
| Route table printer                                                           | `@mta/print-routes-fastify`           | `print-routes-fastapi`           | `mta-ployglot-server-print-routes`            | n/a (utility)  |
| Polyglot HTTP client                                                          | `@polyglot/fetch-http-client`         | `polyglot-fetch-http-client`     | `mta-ployglot-pkg-fetch-client`               | 20             |
| Env resolution (vault → process.env → default)                                | `@org/env-resolve`                    | `env-resolve`                    | `mta-ployglot-pkg-env-resolve`                | 15             |
| App YAML loader (filesystem → merged tree)                                    | `@ployglot/app-yaml-loader`           | `app-yaml-loader`                | `mta-ployglot-pkg-app-yaml-loader`            | 25             |
| Runtime template resolver (engine half of overwrite repo)                     | `@ployglot/runtime-template-resolver` | `runtime-template-resolver`      | `mta-ployglot-pkg-app-yaml-overwrite`         | 26             |
| App YAML config (provider catalog)                                            | `@ployglot/app-yaml-config`           | `app-yaml-config`                | `mta-ployglot-pkg-app-yaml-config`            | 27             |
| App YAML from-context applier (applier half of overwrite repo)                | `@ployglot/app-yaml-from-context`     | `app-yaml-from-context`          | `mta-ployglot-pkg-app-yaml-overwrite`         | 28             |
| App YAML fetch-config (intent → endpoint)                                     | `@ployglot/app-yaml-fetch-config`     | `app-yaml-fetch-config`          | `mta-ployglot-pkg-app-yaml-fetch-config`      | 29             |

Plus `mta-ployglot-pkg-vault` in `workspace.toml` for the gates layer (`make vault-check`); not a direct app-manifest dep.

mjs deps are declared in `server/fastify/package.json#dependencies` as `"file:../../ployglots/<sibling>/packages/<lang-suffix>"`; py deps in `server/fastapi/pyproject.toml#tool.uv.sources` as `{ path = "../../ployglots/<sibling>/packages/<lang-suffix>", develop = true }`. The overwrite repo ships both an engine and an applier package, so it appears twice with different package suffixes (`engine-{mjs,py}` and `applier-{mjs,py}`).

Implication: this repo is **not** self-contained. A fresh clone needs every sibling repo cloned next to it (under the shared parent dir) so the `ployglots/` symlinks resolve. The root `Makefile` `dev-preflight` target aborts early with a clone hint if any are missing. `make bootstrap` clones any missing siblings and lays the symlinks. Use `bash scripts/workspace/print-registry.sh` to dump the full registry as a Markdown table.

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
