# Per-Branch Setup — Fresh Checkout to Working Install

This repo has two long-lived branches with **different topologies** for the
sibling polyglot packages under `ployglots/`. The install steps differ
accordingly. Pick the section for the branch you just checked out:

- [`main`](#main-clone--symlink--emit) — multi-repo dev mode, siblings hydrated as separate clones with symlinks
- [`release/main`](#releasemain-emit-manifests-only) — single-repo release snapshot, siblings flattened in-tree as squashed subtrees

| Branch        | `ployglots/<name>/` topology                                  | Hydration step                            |
| ------------- | ------------------------------------------------------------- | ----------------------------------------- |
| `main`        | Symlinks → sibling clones at `../<name>/`                     | clone siblings + symlink + emit manifests |
| `release/main`| Real directories — squashed git subtrees baked into the branch | emit manifests only (no clone, no symlink) |

If you don't want to think about the difference: **always run `make
bootstrap`**. It detects whether you're on `main` or `release/main` and
dispatches to the right mode.

```bash
git checkout <main|release/main>
make bootstrap          # ← does the right thing for both branches
make node.install
make py.install
```

The rest of this doc explains *why* each branch needs a different step, what
`bootstrap` actually does under the hood, and the manual escape hatches for
when branch auto-detection is wrong (CI on detached HEAD, etc.).

---

## Why this is two flows

`workspace.toml` is the single source of truth for sibling packages. Every
per-language manifest the build needs (`Makefile.entries` driving
`NODE_PKGS` / `PY_PKGS`, `pnpm-workspace.yaml`, `go.work`, `Cargo.toml`,
`.dev/workspace.toml.lock.json`, `docker-compose.yml`) is **generated** from
that registry by emitters under `scripts/workspace/`. None of those
generated files are tracked in git — they're listed in `.gitignore` so the
registry stays the single source.

That gives the same emit step on both branches. What differs is whether the
sibling source code is already on disk:

- **`main`** — a multi-repo workspace. Siblings live as separate clones at
  `../<name>/`, with relative symlinks under `ployglots/<name>/`. Live edits
  in either checkout propagate immediately. Hydration must clone (if missing)
  and symlink.

- **`release/main`** — a single-repo release snapshot. Siblings are flattened
  into the orchestration repo as squashed git subtrees committed at
  `ployglots/<name>/`. The branch is self-contained; there is nothing to
  clone, and nothing to symlink. Hydration must skip the clone+symlink steps
  entirely (the `bootstrap.sh` clone path refuses to overwrite a real
  directory anyway — exit 67) and only run the emitter chain.

Skipping the emit step is the silent-failure trap: `Makefile.entries` is
gitignored, so on a fresh checkout `-include Makefile.entries` is a no-op,
`NODE_PKGS` / `PY_PKGS` are empty, and `make node.install` / `make py.install`
print `skip: NODE_PKGS empty` and exit 0. The build looks fine until a route
fails at request time.

---

## `main`: clone + symlink + emit

Use this on `main` (or any feature branch off `main`). Prerequisites:
`python3`, `git`, plus whatever your dev-mode targets need (`node`, `npm`,
`uv`, optionally `go`, `cargo`).

```bash
git clone <orchestration-repo>
cd mta-ployglot-server
git checkout main

make bootstrap             # auto-selects clone+symlink+emit on main
# equivalent explicit form:
#   make init-clone
#   bash scripts/workspace/bootstrap.sh

make node.install          # iterates $(NODE_PKGS) — runs `pnpm install` per sibling
make py.install            # iterates $(PY_PKGS)   — runs `uv sync` per sibling
make install               # host-side: server/fastify (npm) + server/fastapi (.venv editable installs)
```

What `bootstrap` does on `main` (delegates to
`scripts/workspace/bootstrap.sh`):

1. Reads every `[[entry]]` from `workspace.toml`.
2. For each entry, clones `entry.remote` to `entry.local_path` (`../<name>/`)
   if missing.
3. Creates a relative symlink `ployglots/<name>` → `../<name>/` if missing.
   Refuses to overwrite if `ployglots/<name>` is already a real directory
   (exit 67) — that's how it stays safe to re-run.
4. Runs the emitter chain: `emit-make-vars.sh`, `emit-pnpm.sh`,
   `emit-go-work.sh`, `emit-cargo.sh`, `emit-uv-editable.sh`,
   `workspace-lock-emit.sh`, `docker-compose-emit.sh`.

`bootstrap.sh` is **idempotent** on `main` — re-run it any time. It will
skip clones that already exist and skip symlinks already in place. Use it
after editing `workspace.toml` to refresh manifests.

### Vault override (per-entry local_path)

If a sibling lives somewhere other than `../<name>/` on your machine, set:

```bash
export WORKSPACE_OVERRIDE_<NAME_UPPER>=/abs/path/to/clone
```

Where `<NAME_UPPER>` is the entry name from `workspace.toml` with kebab-case
to `SNAKE_CASE_UPPER` (e.g. `mta-ployglot-pkg-vault` → `MTA_POLYGLOT_PKG_VAULT`,
`print-routes` → `PRINT_ROUTES`). The override wins over `entry.local_path`.

---

## `release/main`: emit manifests only

Use this when the cloud / CI / onboarder checks out `release/main` and the
entire workspace is already a self-contained snapshot. The siblings are real
directories at `ployglots/<name>/`, committed as squashed subtrees by the
`release-assemble` workflow.

```bash
git clone <orchestration-repo>
cd mta-ployglot-server
git checkout release/main

make bootstrap                 # auto-selects re-emit-only on release/main
# equivalent explicit form:
#   bash scripts/workspace/bootstrap.sh --re-emit-only

make node.install              # iterates $(NODE_PKGS) — sees populated registry
make py.install                # iterates $(PY_PKGS)   — sees populated registry
make install                   # same host-side install as on main
```

What `bootstrap` does on `release/main`:

1. Skips the clone step entirely (siblings are in-tree as subtrees).
2. Skips the symlink step entirely (the `ployglots/<name>` paths are real
   directories — `bootstrap.sh` refuses to overwrite them, which is exactly
   what we want).
3. Runs the emitter chain only — same set as the `main` flow:
   `emit-make-vars.sh`, `emit-pnpm.sh`, `emit-go-work.sh`, `emit-cargo.sh`,
   `emit-uv-editable.sh`, `workspace-lock-emit.sh`, `docker-compose-emit.sh`.

Re-running is safe — emitters overwrite their generated outputs in place.

### Why `make init-clone` is wrong on `release/main`

`make init-clone` runs the full hydrate path designed for `main`. On
`release/main` every `ployglots/<name>` is a real directory, so the clone
step would attempt to overwrite, hit `bootstrap.sh`'s safety check, and exit
67 with `FAIL: <path> exists as a real directory; refusing to overwrite`.
Use `make bootstrap` (auto) or
`bash scripts/workspace/bootstrap.sh --re-emit-only` (explicit) instead.

---

## Forcing a mode (`BOOTSTRAP_MODE`)

Branch detection uses `git rev-parse --abbrev-ref HEAD`. In CI runners that
check out by SHA the result is `HEAD`, which falls into the `main` default
— wrong on a `release/main` pipeline. Override explicitly:

```bash
BOOTSTRAP_MODE=reemit make bootstrap   # force release/main mode (emit only)
BOOTSTRAP_MODE=clone  make bootstrap   # force main mode (clone + symlink + emit)
```

Recommended CI snippets:

```yaml
# release-pipeline.yml — checks out release/main by SHA
- run: BOOTSTRAP_MODE=reemit make bootstrap
- run: make node.install py.install
- run: make ci-servers
```

```yaml
# main-ci.yml — checks out main by SHA, needs siblings via clone
- run: BOOTSTRAP_MODE=clone make bootstrap
- run: make node.install py.install
- run: make ci
```

---

## Verifying the result

After `make bootstrap` completes, sanity-check:

```bash
# generated registry projection — must exist and list every sibling
test -f Makefile.entries && cat Makefile.entries

# topology check
ls -la ployglots/
#   on main         : every entry is a symlink → ../<name>/
#   on release/main : every entry is a real directory
```

Then:

```bash
make node.install     # should iterate every sibling, NOT print "skip: NODE_PKGS empty"
make py.install       # should iterate every sibling, NOT print "skip: PY_PKGS empty"
```

If you still see `skip: NODE_PKGS empty`, `Makefile.entries` is missing —
`make bootstrap` either failed silently or wasn't run. Re-run it and check
the output for emitter errors.

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
