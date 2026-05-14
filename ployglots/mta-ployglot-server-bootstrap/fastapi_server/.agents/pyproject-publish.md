---
name: pyproject-publish
scope: fastapi_server
description: Update pyproject.toml and staging files for a PyPI release of thinkeloquent-fastapi-server. Do NOT run publish commands — scaffold a Makefile.publish for the user instead.
triggers:
  - "release"
  - "publish to pypi"
  - "bump version"
  - "pyproject"
  - "twine"
---

# Skill — Prepare a PyPI release (Python side)

> **Do not run publish commands.** Per project memory: scaffold `Makefile.publish` targets and let the user trigger them. PyPI tokens live in `$REGISTRY_PIPY` (prod) and `$REGISTRY_PIPY_TEST` (test).

## The publishable surface

`pyproject.toml` controls what ends up in the wheel/sdist. Key fields:

```toml
[project]
name = "thinkeloquent-fastapi-server"
version = "X.Y.Z"
requires-python = ">=3.11"
dependencies = ["fastapi>=0.115", "uvicorn[standard]>=0.30"]

[project.scripts]
fastapi-server = "fastapi_server.cli:run"

[tool.hatch.build.targets.wheel]
packages = ["fastapi_server"]

[tool.hatch.build.targets.wheel.force-include]
"contracts" = "fastapi_server/contracts"

[tool.hatch.build.targets.sdist]
include = ["fastapi_server", "contracts", "README.md", "LICENSE", "pyproject.toml"]
```

Critical invariants:

1. **Contracts ship inside the wheel.** `force-include` copies the repo's `contracts/` directory into `fastapi_server/contracts/` in the wheel so consumers can load `importlib.resources.files("fastapi_server.contracts")`. Do not remove.
2. **The CLI entrypoint** (`fastapi-server`) must resolve to an existing function (`fastapi_server/cli.py::run`). If you rename, update both.
3. **No `file:` or `path:` dependencies.** PyPI rejects anything that isn't a public version specifier.
4. **`requires-python` must match actual support.** Bumping to 3.12 drops users; bumping down can silently break code.

## Pre-release checklist (no publish yet)

- [ ] `version` bumped in `pyproject.toml` (follow semver — see `contract-parity` skill for when to go major).
- [ ] `CHANGELOG` entry written (if one exists) OR commit message covers it.
- [ ] `pytest` green: `pytest` at the `fastapi_server/` root (includes parity test).
- [ ] `python -m build` produces a sdist and a wheel in `dist/`.
- [ ] `twine check dist/*` reports no issues.
- [ ] Wheel contents inspected: `unzip -l dist/*.whl | grep contracts` shows the three schema files.
- [ ] Scratch install works in a fresh venv: `pip install dist/*.whl && fastapi-server --help`.

Delegate the contents check and scratch install to the `audit-registry-publishability` agent if the package hasn't shipped before or layout changed.

## Makefile.publish targets to scaffold (don't run)

```makefile
# Makefile.publish — user runs these manually.
.PHONY: build publish-test publish

build:
\tpython -m build

publish-test: build
\ttwine upload --repository-url https://test.pypi.org/legacy/ \
\t  -u __token__ -p $$REGISTRY_PIPY_TEST dist/*

publish: build
\ttwine upload -u __token__ -p $$REGISTRY_PIPY dist/*
```

Tabs, not spaces, for Make recipes. The user invokes `make -f Makefile.publish publish-test` → `make -f Makefile.publish publish`.

## Anti-patterns

- Running `twine upload` yourself. User triggers publish, not the agent.
- Leaving `dist/` committed — add to `.gitignore`.
- Adding `fastapi` or `uvicorn` as optional deps — they're mandatory at runtime.
- Dropping `force-include` for `contracts` — breaks `test_contract_parity` at the consumer site.
- Using 0.0.Z for real releases after 0.1.0 shipped — always move forward.
