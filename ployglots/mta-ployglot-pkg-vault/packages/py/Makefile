# packages/py — CI Makefile
#
# Thin wrapper around the uv/pytest/ruff toolchain for local + CI parity.
# Every target is idempotent and safe to re-run. `make ci` is the single
# command CI runs.

SHELL          := /bin/bash
.SHELLFLAGS    := -eu -o pipefail -c
.DEFAULT_GOAL  := help

PKG_DIR        := $(abspath $(CURDIR))
UV             := uv
PYTHON         := python3.11

# ---------------------------------------------------------------------------
# meta
# ---------------------------------------------------------------------------

.PHONY: help
help: ## Show available targets
	@awk 'BEGIN{FS=":.*##"; printf "\nTargets:\n"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: print-env
print-env: ## Print tool versions (debug)
	@echo "pkg-dir : $(PKG_DIR)"
	@$(UV) --version
	@$(PYTHON) --version
	@$(UV) run pytest --version 2>/dev/null || echo "pytest: (run install first)"
	@$(UV) run ruff --version 2>/dev/null || echo "ruff: (run install first)"

# ---------------------------------------------------------------------------
# lifecycle
# ---------------------------------------------------------------------------

.PHONY: install
install: ## Install dependencies (mutable lockfile OK)
	@$(UV) sync

.PHONY: ci-install
ci-install: ## Deterministic install for CI (frozen lockfile)
	@$(UV) sync --frozen

.PHONY: test
test: ## Run pytest suite
	@$(UV) run pytest

.PHONY: lint
lint: ## Static checks (ruff)
	@$(UV) run ruff check src tests

.PHONY: build
build: ## Produce the wheel + sdist under dist/
	@rm -rf dist
	@$(UV) build

.PHONY: cov
cov: ## Run pytest with coverage (HTML + term)
	@rm -rf coverage .coverage
	@$(UV) run pytest

.PHONY: clean
clean: ## Remove generated artifacts
	@rm -rf dist coverage .coverage .pytest_cache .ruff_cache
	@find . -name __pycache__ -prune -exec rm -rf {} + 2>/dev/null || true

.PHONY: distclean
distclean: clean ## Also remove .venv
	@rm -rf .venv

# ---------------------------------------------------------------------------
# CI aggregate
# ---------------------------------------------------------------------------

.PHONY: ci
ci: ci-install lint test build ## Full CI pipeline
