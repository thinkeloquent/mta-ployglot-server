# packages/ts — CI Makefile
#
# Thin wrapper around the TS toolchain for local + CI parity.
# Every target is idempotent and safe to re-run. `make ci` is the single
# command CI runs.

SHELL          := /bin/bash
.SHELLFLAGS    := -eu -o pipefail -c
.DEFAULT_GOAL  := help

PKG_DIR        := $(abspath $(CURDIR))
NPM            := npm
NPX            := npx
NODE           := node

# ---------------------------------------------------------------------------
# meta
# ---------------------------------------------------------------------------

.PHONY: help
help: ## Show available targets
	@awk 'BEGIN{FS=":.*##"; printf "\nTargets:\n"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: print-env
print-env: ## Print tool versions (debug)
	@echo "pkg-dir : $(PKG_DIR)"
	@$(NODE) --version
	@$(NPM) --version
	@$(NPX) tsc --version 2>/dev/null || echo "tsc: (run install first)"

# ---------------------------------------------------------------------------
# lifecycle
# ---------------------------------------------------------------------------

.PHONY: install
install: ## Install dependencies (mutable lockfile OK)
	@$(NPM) install

.PHONY: ci-install
ci-install: ## Deterministic install for CI (frozen lockfile)
	@$(NPM) ci

.PHONY: test
test: ## Run vitest suite
	@$(NPX) vitest run

.PHONY: lint
lint: ## Static checks (tsc --noEmit)
	@$(NPX) tsc -p tsconfig.json --noEmit

.PHONY: no-ts-ignore
no-ts-ignore: ## Fail if @ts-ignore appears in src/
	@if grep -rn '@ts-ignore' src/ 2>/dev/null; then \
	    echo "ERROR: @ts-ignore found in src/ — use a typed alternative"; \
	    exit 1; \
	fi

.PHONY: build
build: ## Produce the dist/ artifact via tsc
	@rm -rf dist
	@$(NPX) tsc -p tsconfig.json

.PHONY: cov
cov: ## Run tests with v8 coverage (HTML + lcov under coverage/)
	@rm -rf coverage
	@$(NPX) vitest run --coverage
	@echo "coverage report written to coverage/"

.PHONY: clean
clean: ## Remove generated artifacts
	@rm -rf dist coverage

.PHONY: distclean
distclean: clean ## Also remove node_modules
	@rm -rf node_modules

# ---------------------------------------------------------------------------
# CI aggregate
# ---------------------------------------------------------------------------

.PHONY: ci
ci: ci-install no-ts-ignore lint test build ## Full CI pipeline
