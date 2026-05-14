---
name: build & CI matrix
description: Cross-language build tools, lock files, test runners, and CI jobs for the polyglot workspace. Flags observed drift between declared tooling and CI config.
type: cross-cutting
scope: root
---

# Build & CI matrix

One row per language. Evidence lives in the files linked below — update this doc when any of them change.

## Per-language tooling

| Dimension | TS (`packages/ts`) | PY (`packages/py`) |
| --- | --- | --- |
| Package manager | npm (workspace at repo root) | uv (workspace at repo root) |
| Manifest | [`packages/ts/package.json`](../packages/ts/package.json) | [`packages/py/pyproject.toml`](../packages/py/pyproject.toml) |
| Root workspace manifest | [`package.json`](../package.json) (`workspaces: ["packages/ts"]`) | [`pyproject.toml`](../pyproject.toml) (`[tool.uv.workspace]`, `members=["packages/py"]`) |
| Lock file | [`package-lock.json`](../package-lock.json) (root) | [`uv.lock`](../uv.lock) (root) |
| Runtime floor | Node ≥ 18 | Python ≥ 3.11 |
| Build tool | `tsup` → ESM `dist/` | `hatchling` → wheel + sdist |
| Test runner | `vitest` (unit) + integration config | `pytest` + `pytest-asyncio` + `respx` |
| Test count (src + tests) | 34 `*.test.ts` under `src/**`, 1 under `tests/integration/` | 12 `test_*.py` under `tests/` |
| Coverage gate | coverage report via `@vitest/coverage-v8` | **100%** (`fail_under = 100` in `pyproject.toml`) |
| Lint / format | `prettier --check src` + `tsc --noEmit` | `ruff check` + `ruff format --check` |
| Integration tests | `vitest.integration.config.ts`, env-gated | `tests/integration/`, env-gated via `it.skipIf`-style guards |
| Makefile | [`packages/ts/Makefile`](../packages/ts/Makefile) | [`packages/py/Makefile`](../packages/py/Makefile) |
| Make entry | `make -C packages/ts ci` | `make -C packages/py ci` |

## CI topology

Single workflow at [`.github/workflows/ci.yml`](../.github/workflows/ci.yml):

| Job | Runs | Matrix | Command | Notes |
| --- | --- | --- | --- | --- |
| `build` | `ubuntu-latest` | `node: [20, 22]` | `make -C packages/ts ci` | Uploads `packages/ts/coverage/` as artifact `coverage-node${{matrix.node}}`. |

Exposed via root npm scripts:
- `npm run ci` → `make -C packages/ts/ ci`
- `npm run ci:py` → `make -C packages/py/ ci`

### Drift to flag

- **CI references pnpm, repo uses npm.** `ci.yml` runs `corepack enable` and caches `~/.pnpm-store` keyed on `**/pnpm-lock.yaml`, but the repo ships `package-lock.json` and the TS Makefile uses `npm ci` / `npm install`. The cache step is a no-op today and the pnpm hook is dead config. Either remove the pnpm steps or switch the toolchain — do not leave this half-migrated.
- **No Python job in CI.** `make -C packages/py ci` is invoked only via `npm run ci:py` locally. PyPI-bound changes are not guarded by GitHub Actions yet. This is a known gap, not a skill-detected accident — adding a `build-py` job to the matrix is the fix.

## Publish prerequisites

Both twins publish to public registries:

- TS → npm as `@polyglot/fetch-http-client`. Allowlist: `"files": ["dist", "README.md"]`. Run `tsup` then `npm pack` via `make pack`.
- PY → PyPI as `polyglot-fetch-http-client`. Wheel ships `packages = ["fetch_http_client"]`. Build via `python -m build`.

Before either publish, run the `audit-registry-publishability` agent to catch workspace leaks (`file:` deps, `tool.uv.sources` workspace pins, stowaway files in the tarball).
