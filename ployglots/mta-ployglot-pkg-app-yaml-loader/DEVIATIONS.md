# Deviations from `app-yaml-loader-20260427-7b3e4f1a` plan

The plan tree under `../AI-Agent-Plans/18/app-yaml-loader-20260427-7b3e4f1a/` is read-only input. Deviations taken during implementation are recorded here instead of in the plan files.

## DEV-01 — `packages/mjs/Makefile` test target uses a glob, not a bare directory

**Plan template:** `ci/makefiles/mjs/Makefile`'s `test` target runs `node --test __tests__`.

**Actual:** Changed to `node --test __tests__/*.test.mjs`.

**Why:** Node 22.17 treats a bare directory argument to `--test` as a single file path (`Cannot find module '.../packages/mjs/__tests__'`). Earlier Node versions auto-discovered, but current behaviour requires either an explicit glob or `--test` with no path arg. The eight standard target names (`help`, `install`, `ci-install`, `lint`, `test`, `build`, `clean`, `ci`) are unchanged; only the body of `test` was edited.

## DEV-02 — `packages/py/src/app_yaml_loader/paths.py` normalises the legacy fallback

**Plan task:** `tasks/02/01/01-resolve-config-dir.md` "py: same control flow, raise `ValueError`, use `pathlib.Path` joins, expose as `resolve_config_dir`."

**Actual:** Wrapped the join with `os.path.normpath(os.path.join(...))` so that the legacy `<callerDir>/../../../../common/config` fallback collapses `..` segments lexically.

**Why:** mjs `path.join` collapses `..` segments; py `os.path.join` does not. The plan's F02 acceptance criterion "mjs ↔ py output matches byte-for-byte for the same input via the parity fixture" forces parity. `os.path.normpath` is the lexical equivalent of mjs's join — no filesystem access required, matching mjs behaviour exactly. The shared `parity/paths.json` "callerDir fallback" case expects the collapsed form (`/repo/common/config`).

## DEV-03 — `parity/paths.json` `expectedError` strings are language-agnostic substrings

**Plan task:** `tasks/02/01/03-tests.md` "asserts byte-equal output (or `expectedError` substring match for raise cases)."

**Actual:** Error fixtures use the substrings `must not be an empty string` and `is required` rather than camelCase identifiers like `configDir is required`.

**Why:** The two ports surface the parameter name differently — mjs throws `Error('configDir is required: …')`, py raises `ValueError('config_dir is required: …')`. The plan task already calls for "substring match", so trimming the case-sensitive token keeps a single shared fixture across both runtimes without weakening coverage.

## DEV-04 — Disk-IO indirection module (`_io.mjs` / `_io.py`)

**Plan task:** `tasks/04/01/03-tests.md` "Use a `spy` on `fs.readFile` (mjs `node:test` mock) / `pathlib.Path.read_text` (py `unittest.mock`) to count disk reads."

**Actual:** Added a tiny `_io` module to each package whose only export is a wrapper (`io.readFile` / `_io.read_text`). The loader imports the wrapper instead of `fs.readFile`/`Path.read_text` directly, and tests spy on the wrapper.

**Why:** Node namespace imports are non-configurable, so `mock.method(fsPromises, 'readFile')` raises `Cannot redefine property: readFile`. The wrapper restores a configurable seam. The py side mirrors the same shape for parity, even though `unittest.mock.patch` could in principle reach `pathlib.Path.read_text` — keeping the seam symmetric makes future refactors safer.

## DEV-05 — Plan extract source path differs from README citation

**Plan README:** Cites `../../../../autoload-04252026/A08b2d3148c2a49f49d710a5f6b36c8e1/platform/polyglot/app_yaml_load/...` as the source extract.

**Actual:** Source files were located at `/Users/Shared/autoload-04252026/mta-v900/platform/polyglot/app_yaml_load/...` (i.e. under `mta-v900/`, not `A08b2d3148c2a49f49d710a5f6b36c8e1/`).

**Why:** The plan was authored against a citation that does not match the on-disk extract directory. No code change required — the source files were used verbatim from the actual location for grounding `loadFiles`, `resolveConfigDir`, etc.
