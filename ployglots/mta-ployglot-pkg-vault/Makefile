SHELL         := /bin/bash
.SHELLFLAGS   := -eu -o pipefail -c
.DEFAULT_GOAL := help

PKGS := packages/ts packages/py

.PHONY: help
help: ## Show available targets
	@awk 'BEGIN{FS=":.*##"; printf "\nTargets:\n"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: ci install test build clean cov lint parity
ci install test build clean cov lint: ## Fan out to both packages
	@for pkg in $(PKGS); do $(MAKE) -C $$pkg $@; done

parity: ## Verify fixture trees byte-identical + run both parity suites
	@diff -r packages/ts/tests/fixtures packages/py/tests/fixtures
	@$(MAKE) -C packages/ts test
	@$(MAKE) -C packages/py test
