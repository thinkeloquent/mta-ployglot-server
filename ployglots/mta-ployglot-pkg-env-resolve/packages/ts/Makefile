# packages/ts — CI Makefile
#
# Thin wrapper around npm + tsc + node:test for local + CI parity. Every
# target is idempotent and safe to re-run. `make ci` is the single command
# CI runs.

SHELL          := /bin/bash
.SHELLFLAGS    := -eu -o pipefail -c
.DEFAULT_GOAL  := help

PKG_DIR        := $(abspath $(CURDIR))
ROOT_DIR       := $(abspath $(CURDIR)/../..)
NPM            ?= npm
NODE           ?= node
NPX            ?= npx
NODE_MIN       := 20

# ---------------------------------------------------------------------------
# meta
# ---------------------------------------------------------------------------

.PHONY: help
help: ## Show available targets
	@awk 'BEGIN{FS=":.*##"; printf "\nTargets:\n"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: print-env
print-env: ## Print tool versions (debug)
	@echo "pkg-dir : $(PKG_DIR)"
	@echo "root-dir: $(ROOT_DIR)"
	@echo "node    : $$($(NODE) --version)"
	@echo "npm     : $$($(NPM) --version)"
	@echo "tsc     : $$($(NPX) tsc --version 2>/dev/null || echo '<not installed>')"

# ---------------------------------------------------------------------------
# lifecycle
# ---------------------------------------------------------------------------

.PHONY: install
install: ## Install dependencies (workspace-aware; runs from repo root)
	@cd $(ROOT_DIR) && $(NPM) install

.PHONY: ci-install
ci-install: ## Deterministic install for CI (npm ci at repo root)
	@cd $(ROOT_DIR) && $(NPM) ci

.PHONY: test
test: ## Run the node:test suite (parity + per-language)
	@cd $(PKG_DIR) && $(NPM) test

.PHONY: test-watch
test-watch: ## Re-run tests on file change
	@cd $(PKG_DIR) && $(NODE) --test --watch --import tsx 'test/**/*.test.ts'

.PHONY: lint
lint: ## Typecheck via tsc --noEmit (treat type errors as lint failures)
	@cd $(PKG_DIR) && $(NPX) tsc --noEmit

.PHONY: build
build: ## Compile TypeScript into ./dist/
	@rm -rf $(PKG_DIR)/dist
	@cd $(PKG_DIR) && $(NPX) tsc -p tsconfig.json
	@ls -1 $(PKG_DIR)/dist

.PHONY: pack
pack: build ## Produce the publishable tarball into ./dist/
	@cd $(PKG_DIR) && $(NPM) pack --pack-destination=$(PKG_DIR)/dist >/dev/null
	@ls -1 $(PKG_DIR)/dist

.PHONY: clean
clean: ## Remove generated artifacts (keeps node_modules)
	@rm -rf $(PKG_DIR)/dist $(PKG_DIR)/coverage $(PKG_DIR)/.nyc_output $(PKG_DIR)/*.tsbuildinfo

.PHONY: distclean
distclean: clean ## Also remove node_modules
	@rm -rf $(PKG_DIR)/node_modules

# ---------------------------------------------------------------------------
# CI aggregate
# ---------------------------------------------------------------------------

.PHONY: ci
ci: ci-install lint test build ## Full CI pipeline (install → lint → test → build)
