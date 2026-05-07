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

## Failure-mode cheatsheet

| Symptom                                             | Likely cause                                           | Fix                                          |
| --------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------- |
| `missing: check-jsonschema` then `FAIL: ... did not validate` (exit 65) | Step 0 skipped — `check-jsonschema` not installed | `uv pip install --system check-jsonschema`   |
| `python3 >= 3.11 required (tomllib)` (exit 127)     | Step 0 skipped — Python is too old                     | Install Python 3.11+; ensure `python3` resolves to it |
| `skip: NODE_PKGS empty` / `skip: PY_PKGS empty`     | Step 2 skipped or `Makefile.entries` not generated     | Re-run `make bootstrap`                      |
| `FAIL: <path> exists as a real directory` (exit 67) | Ran `make init-clone` on `release/main`               | Use `make bootstrap` instead (or `BOOTSTRAP_MODE=reemit`) |
| `branch=HEAD → BOOTSTRAP_MODE=clone` on a `release/main` CI run | Detached HEAD, branch detection wrong         | `BOOTSTRAP_MODE=reemit make bootstrap`       |

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

Related docs:

- [`docs/release-assemble-setup.md`](release-assemble-setup.md) — how
  `release/main` gets assembled in the first place (CI workflow, GitHub App,
  secrets).
- `workspace.toml` — the registry SSOT all of this reads from.
- `scripts/workspace/bootstrap.sh` — the executable contract.
- `scripts/workspace/validate.sh` — the schema check that needs `check-jsonschema`.
