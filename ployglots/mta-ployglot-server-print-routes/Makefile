SHELL          := /bin/bash
.SHELLFLAGS    := -eu -o pipefail -c
.DEFAULT_GOAL  := help

PACKAGES       := packages/mjs packages/py

.PHONY: help
help: ## Show available targets
	@awk 'BEGIN{FS=":.*##"; printf "\nTargets:\n"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: install ci-install test lint build clean distclean ci
install ci-install test lint build clean distclean ci: ## Run the matching target in every package
	@for pkg in $(PACKAGES); do \
	  echo "==> $$pkg: $@" ; \
	  $(MAKE) -C $$pkg $@ ; \
	done
