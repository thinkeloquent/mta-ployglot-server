# Root Makefile — fans out to packages/ts + packages/py.

SHELL         := /bin/bash
.SHELLFLAGS   := -eu -o pipefail -c
.DEFAULT_GOAL := help

TS_DIR := packages/ts
PY_DIR := packages/py

.PHONY: help
help: ## Show available targets
	@awk 'BEGIN{FS=":.*##"; printf "\nTargets:\n"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: install
install: ## Install deps in both packages
	$(MAKE) -C $(TS_DIR) install
	$(MAKE) -C $(PY_DIR) install

.PHONY: ci-install
ci-install: ## Frozen install in both packages
	$(MAKE) -C $(TS_DIR) ci-install
	$(MAKE) -C $(PY_DIR) ci-install

.PHONY: lint
lint: ## Lint both packages
	$(MAKE) -C $(TS_DIR) lint
	$(MAKE) -C $(PY_DIR) lint

.PHONY: test
test: ## Run unit tests in both packages
	$(MAKE) -C $(TS_DIR) test
	$(MAKE) -C $(PY_DIR) test

.PHONY: test-integration
test-integration: ## Run env-gated integration tests in both packages
	$(MAKE) -C $(TS_DIR) test-integration
	$(MAKE) -C $(PY_DIR) test-integration

.PHONY: build
build: ## Build both packages
	$(MAKE) -C $(TS_DIR) build
	$(MAKE) -C $(PY_DIR) build

.PHONY: ci
ci: ## Full CI pipeline on both packages
	$(MAKE) -C $(TS_DIR) ci
	$(MAKE) -C $(PY_DIR) ci

.PHONY: clean
clean: ## Clean both packages
	$(MAKE) -C $(TS_DIR) clean
	$(MAKE) -C $(PY_DIR) clean

.PHONY: distclean
distclean: ## Clean + remove node_modules / .venv
	$(MAKE) -C $(TS_DIR) distclean
	$(MAKE) -C $(PY_DIR) distclean
