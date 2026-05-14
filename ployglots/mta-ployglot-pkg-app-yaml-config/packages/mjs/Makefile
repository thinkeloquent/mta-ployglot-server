# packages/mjs — CI Makefile

SHELL          := /bin/bash
.SHELLFLAGS    := -eu -o pipefail -c
.DEFAULT_GOAL  := help

PKG_DIR        := $(abspath $(CURDIR))
NPM            ?= npm
NODE           ?= node

.PHONY: help
help: ## Show available targets
	@awk 'BEGIN{FS=":.*##"; printf "\nTargets:\n"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: print-env
print-env: ## Print tool versions
	@echo "pkg-dir : $(PKG_DIR)"
	@$(NODE) --version
	@$(NPM)  --version

.PHONY: install
install: ## Install dependencies
	@$(NPM) install

.PHONY: ci-install
ci-install: ## Deterministic install
	@$(NPM) ci

.PHONY: test
test: ## Run the test suite
	@$(NODE) --test '__tests__/**/*.test.mjs'

.PHONY: lint
lint: ## Static checks
	@$(NODE) -e "console.log('lint placeholder')"

.PHONY: build
build: ## Produce dist/
	@rm -rf dist
	@mkdir -p dist
	@cp -R src dist/

.PHONY: clean
clean: ## Remove generated artifacts
	@rm -rf dist

.PHONY: distclean
distclean: clean ## Also remove node_modules
	@rm -rf node_modules

.PHONY: ci
ci: ci-install lint test build ## Full CI pipeline
