# Per-Branch Setup — Step by Step

This repo has two long-lived branches with **different topologies** for the
sibling polyglot packages under `ployglots/`:

- **`main`** — multi-repo dev mode. Siblings are separate clones at
  `../<name>/`, with relative symlinks under `ployglots/<name>/`.
- **`release/main`** — single-repo release snapshot. Siblings are flattened
  in-tree as squashed git subtrees committed at `ployglots/<name>/`.

Steps 0, 3, 4, and 5 are identical for both branches. Step 1 (checkout) and
Step 2 (hydrate) differ — pick the variant that matches your branch.

---

## Step 0 — Install host prerequisites (both branches)

Run once per machine. Install **in the order below** — every later tool
depends on the earlier ones being present. All Python tools are pinned to
exact versions so `main` and `release/main` see byte-identical tooling
across machines.

### 0a. System layer (Homebrew)

| Tool             | Used by                                      | Install                              |
| ---------------- | -------------------------------------------- | ------------------------------------ |
| `python3 3.11.4` | every emitter (`tomllib` is stdlib in 3.11+) — pinned by `.python-version` | `brew install python@3.11` |
| `git`            | clone, subtree, branch detection             | `brew install git`                   |
| `node` + `pnpm`  | `make node.install`                          | `brew install node && npm i -g pnpm` |

### 0b. Bootstrap pipx (one-time)

`pipx` is the only Python tool we install with `pip` directly — every other
Python tool is then installed *through* `pipx` so each one lives in its own
isolated venv. Pinning `pipx` itself keeps the chain reproducible.

```bash
python3 -m pip install --user 'pipx==1.8.0'
python3 -m pipx ensurepath
# (re-source your shell so ~/.local/bin is on PATH)
```

### 0c. Python tooling layer (pipx-managed, exact pins)

Install each via `pipx install --pip-args=...` so the version is locked.
**Do not** use `pip install --user` for these — the venvs prevent host-Python
package collisions.

```bash
pipx install 'rich==14.3.3'
pipx install 'tomlq==0.1.0'
pipx install 'virtualenv==20.36.0'
pipx install 'poetry==2.3.2'
pipx install 'check-jsonschema==0.37.0'
pipx install 'uv==0.11.11'
```

| Tool                       | Used by                                                |
| -------------------------- | ------------------------------------------------------ |
| `rich==14.3.3`             | colorized diagnostics in emitters / scripts            |
| `tomlq==0.1.0`             | TOML querying in `scripts/workspace/` helpers          |
| `virtualenv==20.36.0`      | fallback venv creation on systems where `python -m venv` is broken |
| `poetry==2.3.2`            | poetry-managed siblings under `ployglots/<name>/`      |
| `check-jsonschema==0.37.0` | `validate.sh` — schema-checks `workspace.toml`         |
| `uv==0.11.11`              | `make py.install`, `server/fastapi/.venv` editable installs |

### 0d. Verify

Every line below should print the **exact pinned version**:

```bash
python3 --version          # → Python 3.11.4
git --version
node --version && pnpm --version
pipx --version              # → 1.8.0
rich --version              # → 14.3.3
tomlq --version             # → 0.1.0
virtualenv --version        # → 20.36.0
poetry --version            # → Poetry (version 2.3.2)
check-jsonschema --version  # → 0.37.0
uv --version                # → 0.11.11
```

If any version differs, re-run the matching `pipx install` (or
`pipx upgrade <name>==<exact-version>`). If anything is missing entirely,
**stop here and install it** — `make bootstrap` will fail later with a
misleading "FAIL: ... did not validate" message that actually means a host
tool is missing.

---

## Step 1 — Clone and checkout

### On `main`

```bash
git clone <orchestration-repo>
cd mta-ployglot-server
git checkout main
```

### On `release/main`

```bash
git clone <orchestration-repo>
cd mta-ployglot-server
git checkout release/main
```

---

## Step 2 — Hydrate the workspace

`make bootstrap` auto-detects the branch and runs the right hydration mode.
Run the same command either way:

```bash
make bootstrap
```

What happens internally depends on the branch:

### On `main` — clone + symlink + emit

`make bootstrap` delegates to `bash scripts/workspace/bootstrap.sh` and:

1. Reads every `[[entry]]` from `workspace.toml`.
2. For each entry, clones `entry.remote` to `entry.local_path` (`../<name>/`)
   if missing.
3. Creates a relative symlink `ployglots/<name>` → `../<name>/` if missing.
   (Refuses to overwrite a real directory at `ployglots/<name>` — exit 67.)
4. Runs the emitter chain to write all generated manifests:
   - `Makefile.entries` (drives `NODE_PKGS` / `PY_PKGS`)
   - `pnpm-workspace.yaml`
   - `go.work`
   - `Cargo.toml`
   - `.dev/workspace.toml.lock.json`
   - `docker-compose.yml`

### On `release/main` — emit manifests only

`make bootstrap` delegates to
`bash scripts/workspace/bootstrap.sh --re-emit-only` and:

1. **Skips** the clone step (siblings are already in-tree as subtrees).
2. **Skips** the symlink step (the `ployglots/<name>` paths are already real
   directories — `bootstrap.sh` would refuse to overwrite them anyway).
3. Runs the emitter chain — same set as the `main` flow.

`make bootstrap` is **idempotent** on either branch — re-run it any time you
edit `workspace.toml` or want to refresh manifests.

### Forcing a mode (CI on detached HEAD)

CI runners that check out by SHA report branch `HEAD`, which falls into the
`main` default. Override explicitly:

```bash
BOOTSTRAP_MODE=reemit make bootstrap   # force release/main mode
BOOTSTRAP_MODE=clone  make bootstrap   # force main mode
```

---

## Step 3 — Install per-sibling language deps

Same commands on both branches (the emitter chain in Step 2 populated
`NODE_PKGS` and `PY_PKGS` from `workspace.toml`):

```bash
make node.install     # iterates $(NODE_PKGS) — runs `pnpm install` per sibling
make py.install       # iterates $(PY_PKGS)   — runs `uv sync` per sibling
```

If you see `skip: NODE_PKGS empty` / `skip: PY_PKGS empty`, Step 2 didn't
complete. Go back and re-run `make bootstrap`, then check for emitter
errors in its output.

---

## Step 4 — Install host-side server deps

Same on both branches:

```bash
make install          # = install-node + install-python
```

This runs:

- `install-node` — `npm install` in `server/fastify` (pulls
  `@mta/print-routes-fastify`, `fastify-server`, etc. via `file:` refs into
  `ployglots/<name>/`).
- `install-python` — creates `server/fastapi/.venv` (Python 3.11) and
  `pip install -e` every workspace py twin (`bootstrap`, `print-routes`,
  `fetch-client`, `env-resolve`, `app-yaml-loader`, `app-yaml-overwrite`,
  `app-yaml-config`, `app-yaml-fetch-config`, `uvicorn[standard]`).

> **Note:** `make install` is sufficient when you run the servers directly
> from `server/fastify/` and `server/fastapi/`. The Step 6 runners
> (`make dev` / `make prod`) stage their own copies under `.dev/` /
> `.prod/` and invoke their own install steps — they do NOT depend on
> `make install`.

---

## Step 5 — Verify

Same checks on both branches:

```bash
# 5a. generated registry projection — must exist and list every sibling
test -f Makefile.entries && cat Makefile.entries

# 5b. topology check
ls -la ployglots/
#   on main         : every entry is a symlink → ../<name>/
#   on release/main : every entry is a real directory

# 5c. tool versions visible to the build
make print-env

# 5d. per-sibling installs landed
ls server/fastify/node_modules/@mta/print-routes-fastify  >/dev/null && echo ok-node
ls server/fastapi/.venv/bin/python                         >/dev/null && echo ok-py
```

You're done when:

- `Makefile.entries` exists and lists every sibling.
- `ls ployglots/` matches the topology row for your branch.
- `make node.install` and `make py.install` iterate (no `skip: ... empty`).
- `make install` completes without errors.

---

## Step 6 — Run the servers

Two host-direct run modes are available. They stage independent copies of
the runtime tree under `.dev/` and `.prod/` so you never mutate
`server/fastify/` or `server/fastapi/` directly.

### Dev mode — co-developed siblings, live edits flow

```bash
make dev             # background: stages .dev/, runs both servers, writes pids+logs
make dev-fg          # foreground parallel: cloud / CI canonical (Ctrl-C to stop)
make dev-fastify     # foreground fastify, with `node --watch`
make dev-fastapi     # foreground fastapi
make dev-healthz     # sleeps 5s, then curls /healthz on both
make dev-stop        # stop background runners
make dev-logs        # tail all six log streams
make dev-clean       # nuke .dev/ entirely
```

`make dev` (background) vs `make dev-fg` (foreground):

| Concern             | `make dev` (background)              | `make dev-fg` (foreground-parallel) |
| ------------------- | ------------------------------------ | ----------------------------------- |
| Returns immediately | yes — operator keeps the shell       | no — blocks until Ctrl-C            |
| PID tracking        | `.dev/<svc>.pid` written              | none — children of the make process |
| Logs                | files only (3 streams per service)   | `tee` to file + stdout (1 stream)   |
| Signal propagation  | requires `make dev-stop`              | natural via job control + `wait`    |
| Best for            | local iteration                       | cloud / CI / Docker / k8s           |

`make dev-install` runs the fastify and fastapi installs **in parallel** via
`$(MAKE) -j2 dev-install-fastify dev-install-fastapi` (mirrors the reference
platform pattern). Output interleaves on the terminal — accepted trade-off
for a faster install.

`make dev`:

1. Builds `dist/` in every TS twin (`make build.npm` / `dev-prebuild-siblings`).
2. Stages `ployglots/mta-ployglot-server-bootstrap/fastify_server` →
   `.dev/fastify` and `npm ci`s + builds it.
3. Stages `server/fastify` → `.dev/fastify-app`, `npm ci`s, then **replaces
   sibling deps in `node_modules/` with symlinks** so live edits in
   `../<sibling>/` flow into the running server without reinstall.
4. Creates `.dev/fastapi/.venv` and `uv pip install -e` every workspace
   py twin (also live-edit-friendly).
5. Launches both servers in the background with `POLYGLOT_DEBUG=1` and
   `node --watch`.

### Prod mode — frozen runtime, no live edits

```bash
make prod            # background: stages .prod/, runs both servers
make prod-fastify    # foreground fastify, NODE_ENV=production, no --watch
make prod-fastapi    # foreground fastapi (single-worker today; see note below)
make prod-stop       # graceful TERM → 10s → KILL, by-PID only
make prod-restart    # = prod-stop && prod
make prod-logs       # tail all six log streams
make prod-healthz    # curl /healthz on both servers
make prod-clean      # nuke .prod/ entirely
```

### Diagnostics — `make dev-doctor` / `make prod-doctor`

Run these any time something fails during install or launch. They are
read-only and emit a sectioned PASS/WARN/FAIL report covering:

- host tools (node / npm / uv / python3 versions)
- env state (UV_NATIVE_TLS, SSL_CERT_FILE, PYTHON_REGISTRY_URL, NPM_REGISTRY,
  proxy vars)
- TLS reachability — curl-probe the configured Python registry; curl uses
  the macOS Keychain, so a curl-PASS + uv-FAIL points at `UV_NATIVE_TLS`
- uv resolver smoke — `uv pip install --dry-run uvicorn` in a temp venv
- sibling layout under `ployglots/` (symlink target, missing entries)
- staging dir state (`.dev/` or `.prod/`) — venv health, node_modules
  shape; symlink-vs-real-dir is mode-aware (warn if dev has copies, warn
  if prod has symlinks)
- port bindings on `FASTIFY_PORT` / `FASTAPI_PORT` (or their PROD_*
  overrides)

```bash
make dev-doctor      # before/after `make dev` — surface install + TLS issues
make prod-doctor     # before/after `make prod`
```

The script lives at `scripts/workspace/runtime-doctor.sh`; invoke directly
with `bash scripts/workspace/runtime-doctor.sh dev|prod` if you need to
run it outside the make wrapper.

How prod differs from dev:

| Concern         | dev (`.dev/`)              | prod (`.prod/`)                        |
| --------------- | -------------------------- | -------------------------------------- |
| Sibling deps    | symlinked (live edits)     | `cp -R` after `npm ci` (frozen)        |
| Python installs | `uv pip install -e <path>` | `uv pip install <path>` (non-editable) |
| npm install     | full deps                  | `npm ci --omit=dev`                    |
| Runtime env     | `POLYGLOT_DEBUG=1`, watch  | `NODE_ENV=production`, no watch        |
| Stop semantics  | `pkill -f` + own PIDs      | own PIDs only (TERM → 10s → KILL)      |

Default ports are shared (`FASTIFY_PORT=5100`, `FASTAPI_PORT=5200`), so
`make dev` and `make prod` cannot run concurrently. Override
`PROD_FASTIFY_PORT` / `PROD_FASTAPI_PORT` in `.env` to run side-by-side.

> **Note on `PROD_FASTAPI_WORKERS`:** wired into `Makefile.vars` and
> `.env.example` as a knob, but currently a no-op —
> `server/fastapi/main.py` calls `uvicorn.run(app, ...)` with an instance
> rather than an import-string factory, so uvicorn cannot fork workers.
> Multi-worker prod requires `main.py` to expose a sync factory callable.

---

## Corporate-network setup (one-time, opt-in)

The repo's install pipeline is registry-and-cert-aware. If you are on a
machine where the package registries are reached through a corporate
Artifactory / proxy that presents an internally-issued TLS cert, copy
`.env.example` to `.env` and set:

```bash
# .env
UV_NATIVE_TLS=true
# PYTHON_REGISTRY_URL=https://artifactory.<corp>/api/pypi/pypi/simple/
# SSL_CERT_FILE=/path/to/corp-ca.pem      # if uv still rejects the cert
# NODE_EXTRA_CA_CERTS=/path/to/corp-ca.pem
```

`UV_NATIVE_TLS=true` makes `uv 0.9+` use the OS-native TLS stack (macOS
Keychain) instead of its bundled rustls/webpki CA list. Without it, you
will see `invalid peer certificate: UnknownIssuer` from any `uv pip
install` that traverses the corporate proxy. `Makefile.vars` only exports
the variable when set to a non-`0` value, so non-corp contributors are
unaffected.

See `.env.example` for the full set of corp knobs (`PIP_CERT`,
`NODE_EXTRA_CA_CERTS`, `SSL_CERT_FILE`, `NO_PROXY`, `PYTHON_REGISTRY_URL`,
etc.).

---

## Failure-mode cheatsheet

| Symptom                                             | Likely cause                                           | Fix                                          |
| --------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------- |
| `missing: check-jsonschema` then `FAIL: ... did not validate` (exit 65) | Step 0 skipped — `check-jsonschema` not installed | `uv pip install --system check-jsonschema`   |
| `python3 >= 3.11 required (tomllib)` (exit 127)     | Step 0 skipped — Python is too old                     | Install Python 3.11+; ensure `python3` resolves to it |
| `skip: NODE_PKGS empty` / `skip: PY_PKGS empty`     | Step 2 skipped or `Makefile.entries` not generated     | Re-run `make bootstrap`                      |
| `FAIL: <path> exists as a real directory` (exit 67) | Ran `make init-clone` on `release/main`               | Use `make bootstrap` instead (or `BOOTSTRAP_MODE=reemit`) |
| `branch=HEAD → BOOTSTRAP_MODE=clone` on a `release/main` CI run | Detached HEAD, branch detection wrong         | `BOOTSTRAP_MODE=reemit make bootstrap`       |
| `uv pip install` → `invalid peer certificate: UnknownIssuer` (Artifactory / corp proxy) | uv 0.9+ ships its own webpki CA list and ignores the macOS Keychain | Add `UV_NATIVE_TLS=true` to `.env`; confirm with `make dev-doctor` (see "Corporate-network setup") |
| `port <N> in use` from `make dev` / `make prod`     | Other runner still alive, or docker compose holding the port | `make dev-stop` / `make prod-stop`; if compose: `docker compose down` |
| `port <N> still in use after cleanup` (`make dev`)  | Foreign process bound to FASTIFY/FASTAPI_PORT          | `lsof -iTCP:<N> -sTCP:LISTEN -nP` — kill or override `FASTIFY_PORT` / `FASTAPI_PORT` |

---

## Quick reference

| Task                                                              | Command                                              |
| ----------------------------------------------------------------- | ---------------------------------------------------- |
| Fresh checkout of `main`                                          | `make bootstrap` *or* `make init-clone`              |
| Fresh checkout of `release/main`                                  | `make bootstrap` *or* `BOOTSTRAP_MODE=reemit make bootstrap` |
| Force `main` mode (clone + symlink) on a detached HEAD            | `BOOTSTRAP_MODE=clone make bootstrap`                |
| Force `release/main` mode (emit only) on a detached HEAD          | `BOOTSTRAP_MODE=reemit make bootstrap`               |
| Refresh manifests after editing `workspace.toml`                  | `make bootstrap` (idempotent on either branch)       |
| Hydrate as in-tree subtrees on a non-release branch (rare)        | `make init-subtree`                                  |
| Just lock-emit + submodule init (no hydrate, no manifest emit)    | `make init`                                          |
| Run both servers in dev mode (live edits flow into siblings)      | `make dev` (bg) / `make dev-fg` (fg, cloud-canonical) / per-svc: `make dev-fastify` / `make dev-fastapi` |
| Health-check both dev servers                                     | `make dev-healthz`                                   |
| Stop dev servers / nuke `.dev/` staging                           | `make dev-stop` / `make dev-clean`                   |
| Run both servers in prod mode (frozen, NODE_ENV=production)       | `make prod` / foreground: `make prod-fastify` / `make prod-fastapi` |
| Stop prod servers / nuke `.prod/` staging                         | `make prod-stop` / `make prod-clean`                 |
| Tail all six log streams                                          | `make dev-logs` *or* `make prod-logs`                |
| Health-check both prod servers                                    | `make prod-healthz`                                  |
| Trust corporate Artifactory cert (uv `UnknownIssuer` fix)         | Add `UV_NATIVE_TLS=true` to `.env`                   |
| Diagnose install / TLS / port issues                              | `make dev-doctor` *or* `make prod-doctor`            |

Related docs:

- [`docs/release-assemble-setup.md`](release-assemble-setup.md) — how
  `release/main` gets assembled in the first place (CI workflow, GitHub App,
  secrets).
- `workspace.toml` — the registry SSOT all of this reads from.
- `scripts/workspace/bootstrap.sh` — the executable contract.
- `scripts/workspace/validate.sh` — the schema check that needs `check-jsonschema`.
