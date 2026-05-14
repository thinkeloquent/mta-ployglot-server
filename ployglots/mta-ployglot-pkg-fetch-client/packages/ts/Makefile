# packages/ts — CI Makefile
#
# Thin wrapper around the package's native toolchain (npm + tsup + vitest + prettier + tsc).
# Every target is idempotent and safe to re-run. `make ci` is the single command CI runs.

SHELL          := /bin/bash
.SHELLFLAGS    := -eu -o pipefail -c
.DEFAULT_GOAL  := help

PKG_DIR        := $(abspath $(CURDIR))
NPM            ?= npm
NODE           ?= node
NPX            ?= npx

# ---------------------------------------------------------------------------
# meta
# ---------------------------------------------------------------------------

.PHONY: help
help: ## Show available targets
	@awk 'BEGIN{FS=":.*##"; printf "\nTargets:\n"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: print-env
print-env: ## Print tool versions (debug)
	@echo "pkg-dir : $(PKG_DIR)"
	@echo -n "node    : "; $(NODE) --version
	@echo -n "npm     : "; $(NPM) --version
	@echo -n "tsc     : "; $(NPX) tsc --version 2>/dev/null || echo "(not installed)"
	@echo -n "tsup    : "; $(NPX) tsup --version 2>/dev/null || echo "(not installed)"
	@echo -n "vitest  : "; $(NPX) vitest --version 2>/dev/null || echo "(not installed)"
	@echo -n "prettier: "; $(NPX) prettier --version 2>/dev/null || echo "(not installed)"

# ---------------------------------------------------------------------------
# lifecycle
# ---------------------------------------------------------------------------

.PHONY: install
install: ## Install dependencies (mutable lockfile OK)
	cd $(PKG_DIR)/../.. && $(NPM) install

.PHONY: ci-install
ci-install: ## Deterministic install for CI (frozen lockfile)
	cd $(PKG_DIR)/../.. && $(NPM) ci

.PHONY: typecheck
typecheck: ## Run tsc --noEmit
	$(NPX) tsc --noEmit

.PHONY: lint
lint: ## Static checks (prettier --check + tsc --noEmit)
	$(NPX) prettier --check src
	$(NPX) tsc --noEmit

.PHONY: lint-fix
lint-fix: ## Auto-fix formatting
	$(NPX) prettier --write src

.PHONY: test
test: ## Run the package test suite
	$(NPX) vitest run

.PHONY: test-watch
test-watch: ## Run tests in watch mode
	$(NPX) vitest

.PHONY: test-integration
test-integration: ## Run integration tests against live services (requires env vars)
	$(NPX) vitest run --config vitest.integration.config.ts

.PHONY: coverage
coverage: ## Run tests with coverage report
	$(NPX) vitest run --coverage

.PHONY: build
build: ## Produce the distributable artifact into ./dist/
	@rm -rf dist
	$(NPX) tsup

.PHONY: pack
pack: build ## Produce a publishable tarball
	$(NPM) pack

.PHONY: clean
clean: ## Remove generated artifacts
	@rm -rf dist *.tgz coverage
	@find . -type d -name '.vitest-cache' -prune -exec rm -rf {} +
	@find . -type d -name '.tsbuildinfo' -prune -exec rm -rf {} +

.PHONY: distclean
distclean: clean ## Also remove installed dependencies
	@rm -rf node_modules

# ---------------------------------------------------------------------------
# CI aggregate
# ---------------------------------------------------------------------------

.PHONY: ci
ci: ci-install lint test build ## Full CI pipeline (ci-install → lint → test → build)
