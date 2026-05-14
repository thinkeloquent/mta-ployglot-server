# Build Matrix

No `.github/workflows/` exists yet — CI is currently `make`-orchestrated and runnable locally. The single command at the repo root is `make ci`, which fans out to both per-package Makefiles fail-fast.

## Per-language toolchain

| Language | Package manager        | Lock file                    | Test runner                                           | Lint                                  | Build                                |
|----------|------------------------|------------------------------|-------------------------------------------------------|---------------------------------------|--------------------------------------|
| ts       | `npm` (workspaces)     | `package-lock.json` (root)   | `node --test --import tsx 'test/**/*.test.ts'`        | `tsc --noEmit`                        | `tsc -p tsconfig.json` → `dist/index.{js,d.ts}` |
| py       | `uv` (preferred) / `pip` | `uv.lock` (root) when uv used | `pytest -q` (via `uv run pytest` when `uv` on PATH)  | `ruff check .` + `mypy --strict`      | `python -m build` / `uv build` → sdist + wheel |

Both per-package Makefiles auto-detect which interpreter / tooling is available at runtime; the Python Makefile falls back to `python -m pip` + `pytest` when `uv` is absent.

## Standard target contract

Every per-package Makefile exposes these eight targets (per [`AI-Agent-Plans/.../ci/README.md`](../tests/parity/fixtures.json) — see plan tree):

| Target       | Contract                                                            |
| ------------ | ------------------------------------------------------------------- |
| `help`       | Default goal. Prints the target list with docstrings.               |
| `install`    | Local-dev install (mutable lockfile allowed).                       |
| `ci-install` | Deterministic install for CI (frozen lockfile).                     |
| `lint`       | Static checks. Non-zero on failure. No network.                     |
| `test`       | Runs the package's parity + per-language suites. Non-zero on fail.  |
| `build`      | Produces the distributable artifact under `./dist/`.                |
| `clean`      | Removes generated artifacts. Idempotent. Never touches source.      |
| `ci`         | Aggregate: `ci-install` → `lint` → `test` → `build`.                |

Additional targets (`pack`, `test-watch`, `print-env`, `distclean`) are present in both Makefiles.

## Root orchestrator

```makefile
make ci-install   # install both packages
make ci-ts        # full CI for the TypeScript package only
make ci-py        # full CI for the Python package only
make ci           # ci-ts then ci-py (fail-fast; equivalent to `&&`)
make clean        # clean both packages
```

## Bootstrap notes

- `npm ci` requires a committed `package-lock.json`. On a fresh clone, run `make install` once at the TS package level (or `npm install` at the repo root) to generate the lockfile, then commit it. `make ci` will work on subsequent runs.
- The Python `dev` extras live under `[project.optional-dependencies]`. `uv sync --dev` does not pick those up (it expects `[dependency-groups] dev`). The Makefile's fallback `uv pip install -e ".[dev]"` is what actually installs `pytest` / `ruff` / `mypy` / `build`. A future migration to `[dependency-groups]` would let `uv sync --dev` work directly.

## Tested pipeline status (2026-04-27)

- `make ci-ts`: TypeScript pipeline green — 50 tests pass, build emits `dist/index.{js,d.ts,js.map,d.ts.map}`.
- `make ci-py`: Python pipeline green — 45 tests pass, build emits `env_resolve-0.1.0-py3-none-any.whl` + sdist.
