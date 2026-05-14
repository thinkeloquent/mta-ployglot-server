# env-resolve polyglot — root orchestrator.
#
# Delegates to per-package Makefiles. `make ci` at the repo root is the single
# command that proves both languages still pass.

SHELL          := /bin/bash
.SHELLFLAGS    := -eu -o pipefail -c
.DEFAULT_GOAL  := help

PACKAGES_TS    := packages/ts
PACKAGES_PY    := packages/py

.PHONY: help
help: ## Show available targets
	@awk 'BEGIN{FS=":.*##"; printf "\nTargets:\n"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: ci-install
ci-install: ## Install both packages for CI
	@$(MAKE) -C $(PACKAGES_TS) ci-install
	@$(MAKE) -C $(PACKAGES_PY) ci-install

.PHONY: ci-ts
ci-ts: ## Run full CI for TypeScript package only
	@$(MAKE) -C $(PACKAGES_TS) ci

.PHONY: ci-py
ci-py: ## Run full CI for Python package only
	@$(MAKE) -C $(PACKAGES_PY) ci

.PHONY: ci
ci: ci-ts ci-py ## Full polyglot CI (both languages, fail-fast)

.PHONY: clean
clean: ## Clean both packages
	@$(MAKE) -C $(PACKAGES_TS) clean
	@$(MAKE) -C $(PACKAGES_PY) clean
