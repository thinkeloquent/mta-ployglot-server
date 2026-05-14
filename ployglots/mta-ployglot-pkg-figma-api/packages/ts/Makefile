# packages/ts — CI Makefile for @polyglot/figma-api

SHELL         := /bin/bash
.SHELLFLAGS   := -eu -o pipefail -c
.DEFAULT_GOAL := help

PKG_DIR := $(abspath $(CURDIR))
NPM     ?= npm
NODE    ?= node
NPX     ?= npx
TSC     ?= $(NPX) tsc
VITEST  ?= $(NPX) vitest
TSX     ?= $(NPX) tsx

.PHONY: help
help: ## Show available targets
	@awk 'BEGIN{FS=":.*##"; printf "\nTargets:\n"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: install
install: ## Install deps (mutable lockfile OK)
	cd ../.. && $(NPM) install

.PHONY: ci-install
ci-install: ## Deterministic install for CI
	cd ../.. && $(NPM) ci

.PHONY: typecheck
typecheck: ## Type-check without emitting
	$(TSC) --noEmit

.PHONY: lint
lint: ## Prettier + tsc typecheck
	$(NPX) prettier --check src tests examples
	$(TSC) --noEmit

.PHONY: lint-fix
lint-fix: ## Auto-format with prettier
	$(NPX) prettier --write src tests examples

.PHONY: test
test: ## Run vitest unit suite with 100% coverage gate
	$(VITEST) run --coverage

.PHONY: test-watch
test-watch: ## Run vitest in watch mode
	$(VITEST) watch

.PHONY: test-coverage
test-coverage: ## Unit tests with coverage
	$(VITEST) run --coverage

.PHONY: test-integration
test-integration: ## Env-gated integration tests (needs FIGMA_PASS)
	$(VITEST) run --config vitest.integration.config.ts

.PHONY: build
build: ## Emit TypeScript to ./dist
	rm -rf dist
	$(TSC) -p tsconfig.json

.PHONY: example
example: ## Run the default SDK example (needs FIGMA_PASS)
	$(TSX) examples/sdk/01-basic-usage.ts

.PHONY: pack
pack: build ## Produce npm tarball into ./artifacts
	rm -rf artifacts && mkdir -p artifacts
	$(NPM) pack --pack-destination artifacts
	ls -lh artifacts/

.PHONY: clean
clean: ## Remove build artifacts
	rm -rf dist coverage artifacts .vitest

.PHONY: distclean
distclean: clean ## Also remove node_modules
	rm -rf node_modules

.PHONY: ci
ci: ci-install lint test build ## Full CI pipeline
