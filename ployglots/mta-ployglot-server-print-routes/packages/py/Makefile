# packages/py — CI Makefile
#
# Thin wrapper around uv/python for local + CI parity. Uses `uv` when
# present (fast, lockable) and falls back to plain `python -m pip`/`pytest`
# so the same targets work on a bare CI runner. `make ci` is the single
# command CI runs.

SHELL          := /bin/bash
.SHELLFLAGS    := -eu -o pipefail -c
.DEFAULT_GOAL  := help

PKG_DIR        := $(abspath $(CURDIR))
PY_MIN         := 3.11

# Prefer uv when available; otherwise fall back to the system interpreter.
UV             := $(shell command -v uv 2>/dev/null)
ifeq ($(UV),)
PY             ?= python3
PIP            ?= $(PY) -m pip
PYTEST         ?= $(PY) -m pytest
RUN            :=
BUILD          := $(PY) -m build --outdir $(PKG_DIR)/dist
else
PY             ?= uv run python
PIP            ?= uv pip
PYTEST         ?= uv run pytest
RUN            := uv run
BUILD          := uv build --package print-routes-fastapi --out-dir $(PKG_DIR)/dist
endif

# ---------------------------------------------------------------------------
# meta
# ---------------------------------------------------------------------------

.PHONY: help
help: ## Show available targets
	@awk 'BEGIN{FS=":.*##"; printf "\nTargets:\n"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: print-env
print-env: ## Print tool versions (debug)
	@echo "pkg-dir : $(PKG_DIR)"
	@echo "python  : $$($(PY) --version 2>&1)"
ifeq ($(UV),)
	@echo "uv      : <not installed — using system python>"
else
	@echo "uv      : $(UV)"
endif

# ---------------------------------------------------------------------------
# lifecycle
# ---------------------------------------------------------------------------

.PHONY: install
install: ## Install package + dev deps (editable)
ifeq ($(UV),)
	@$(PIP) install --upgrade pip build pytest ruff
	@$(PIP) install -e "$(PKG_DIR)[dev]"
else
	@cd $(PKG_DIR) && uv sync --extra dev || uv pip install -e ".[dev]"
endif

.PHONY: ci-install
ci-install: install ## Deterministic install for CI (alias today; swap to frozen lock later)

.PHONY: test
test: ## Run pytest
	@cd $(PKG_DIR) && $(PYTEST) -q

.PHONY: test-watch
test-watch: ## Re-run tests on change (requires pytest-watch)
	@cd $(PKG_DIR) && $(RUN) ptw -- -q

.PHONY: lint
lint: ## Static checks (ruff if available, else py_compile)
	@cd $(PKG_DIR) && if command -v ruff >/dev/null 2>&1 || [ -n "$(UV)" ]; then \
	    $(RUN) ruff check . ; \
	else \
	    find print_routes_fastapi tests -name '*.py' -print0 | xargs -0 -n1 $(PY) -m py_compile ; \
	fi

.PHONY: build
build: ## Build sdist + wheel into ./dist/
	@rm -rf dist
	@cd $(PKG_DIR) && $(BUILD)
	@ls -1 dist

.PHONY: clean
clean: ## Remove build/test artifacts
	@rm -rf dist build .pytest_cache .ruff_cache htmlcov .coverage
	@find . -type d \( -name __pycache__ -o -name '*.egg-info' \) -prune -exec rm -rf {} +

.PHONY: distclean
distclean: clean ## Also remove virtualenvs
	@rm -rf .venv

# ---------------------------------------------------------------------------
# CI aggregate
# ---------------------------------------------------------------------------

.PHONY: ci
ci: ci-install lint test build ## Full CI pipeline (install → lint → test → build)
