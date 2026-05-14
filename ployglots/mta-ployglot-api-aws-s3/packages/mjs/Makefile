# packages/mjs — CI Makefile
#
# Thin wrapper around pnpm/tsc/vitest for local + CI parity. `make ci`
# is the single command CI runs.

SHELL          := /bin/bash
.SHELLFLAGS    := -eu -o pipefail -c
.DEFAULT_GOAL  := help

PKG_DIR        := $(abspath $(CURDIR))
ROOT_DIR       := $(abspath $(CURDIR)/../..)
PNPM           ?= pnpm

.PHONY: help
help: ## Show available targets
	@awk 'BEGIN{FS=":.*##"; printf "\nTargets:\n"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: print-env
print-env: ## Print tool versions (debug)
	@echo "pkg-dir : $(PKG_DIR)"
	@echo "root-dir: $(ROOT_DIR)"
	@node --version
	@$(PNPM) --version

.PHONY: install
install: ## Install dependencies (workspace-aware; runs from repo root)
	@cd $(ROOT_DIR) && $(PNPM) install

.PHONY: ci-install
ci-install: ## Deterministic install for CI (frozen lockfile at repo root)
	@cd $(ROOT_DIR) && $(PNPM) install --frozen-lockfile

.PHONY: lint
lint: ## Typecheck + eslint (src + test)
	@cd $(PKG_DIR) && $(PNPM) exec tsc --noEmit
	@cd $(PKG_DIR) && $(PNPM) exec eslint "src/**/*.ts" "test/**/*.ts"

.PHONY: test
test: ## Run vitest
	@cd $(PKG_DIR) && $(PNPM) exec vitest run

.PHONY: test-watch
test-watch: ## Re-run tests on change
	@cd $(PKG_DIR) && $(PNPM) exec vitest

.PHONY: build
build: ## Produce dist/ (library only)
	@cd $(PKG_DIR) && rm -rf dist
	@cd $(PKG_DIR) && $(PNPM) exec tsc -p tsconfig.build.json

.PHONY: pack
pack: build ## Produce the publishable tarball into ./dist/
	@cd $(PKG_DIR) && $(PNPM) pack --pack-destination=$(PKG_DIR)/dist >/dev/null
	@ls -1 $(PKG_DIR)/dist

.PHONY: clean
clean: ## Remove generated artifacts
	@rm -rf $(PKG_DIR)/dist $(PKG_DIR)/.tsbuildinfo $(PKG_DIR)/coverage

.PHONY: distclean
distclean: clean ## Also remove installed deps
	@rm -rf $(PKG_DIR)/node_modules

.PHONY: ci
ci: ci-install lint test build ## Full CI pipeline
