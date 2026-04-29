# examples-mjs — CI Makefile (Node ESM SDK example runner)
#
# Installs the four app-yaml-chain mjs SDKs from the local sibling repos,
# then runs every numbered example script in order. `make ci` is the single
# command CI runs.

SHELL          := /bin/bash
.SHELLFLAGS    := -eu -o pipefail -c
.DEFAULT_GOAL  := help

PKG_DIR        := $(abspath $(CURDIR))
REPO_ROOT      := $(abspath $(PKG_DIR)/../../../..)
SIBLINGS_ROOT  := $(REPO_ROOT)/ployglots
NODE           ?= node
NPM            ?= npm
JQ             ?= jq

# ---------------------------------------------------------------------------
# meta
# ---------------------------------------------------------------------------

.PHONY: help
help: ## Show available targets
	@awk 'BEGIN{FS=":.*##"; printf "\nTargets:\n"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: print-env
print-env: ## Print tool versions (debug)
	@echo "pkg-dir   : $(PKG_DIR)"
	@echo "repo-root : $(REPO_ROOT)"
	@$(NODE) --version
	@$(NPM)  --version
	@$(JQ)   --version 2>/dev/null || echo "jq missing — install for parity diff"

# ---------------------------------------------------------------------------
# lifecycle
# ---------------------------------------------------------------------------

.PHONY: install
install: ## Install dependencies (link sibling SDK packages, install local deps)
	@cd $(PKG_DIR) && [ -f package.json ] && $(NPM) install || echo "no package.json — pure example dir"
	@$(MAKE) link-siblings

.PHONY: ci-install
ci-install: ## Deterministic install for CI (npm ci instead of npm install)
	@cd $(PKG_DIR) && [ -f package.json ] && $(NPM) ci || echo "no package.json — pure example dir"
	@$(MAKE) link-siblings

.PHONY: link-siblings
link-siblings: ## Symlink the four mjs SDKs into local node_modules/@ployglot/
	@mkdir -p $(PKG_DIR)/node_modules/@ployglot
	@for s in app-yaml-config app-yaml-loader app-yaml-fetch-config; do \
	  rm -rf $(PKG_DIR)/node_modules/@ployglot/$$s; \
	  ln -s $(SIBLINGS_ROOT)/mta-ployglot-pkg-$$s/packages/mjs $(PKG_DIR)/node_modules/@ployglot/$$s; \
	done
	@rm -rf $(PKG_DIR)/node_modules/@ployglot/runtime-template-resolver
	@ln -s $(SIBLINGS_ROOT)/mta-ployglot-pkg-app-yaml-overwrite/packages/engine-mjs $(PKG_DIR)/node_modules/@ployglot/runtime-template-resolver
	@rm -rf $(PKG_DIR)/node_modules/@ployglot/app-yaml-from-context
	@ln -s $(SIBLINGS_ROOT)/mta-ployglot-pkg-app-yaml-overwrite/packages/applier-mjs $(PKG_DIR)/node_modules/@ployglot/app-yaml-from-context
	@# js-yaml: needed by 19-refresh; reuse the loader sibling's installed copy.
	@rm -rf $(PKG_DIR)/node_modules/js-yaml
	@ln -s $(SIBLINGS_ROOT)/mta-ployglot-pkg-app-yaml-loader/node_modules/js-yaml $(PKG_DIR)/node_modules/js-yaml

.PHONY: lint
lint: lint-syntax lint-types ## Static checks: node --check + tsc --noEmit when available

.PHONY: lint-syntax
lint-syntax: ## node --check every example script
	@for f in $(PKG_DIR)/[0-9][0-9]-*.mjs; do $(NODE) --check $$f; done
	@echo "lint-syntax OK"

.PHONY: lint-types
lint-types: ## tsc --noEmit (skipped if no tsconfig.json)
	@if [ -f $(PKG_DIR)/tsconfig.json ] && [ -x $(PKG_DIR)/node_modules/.bin/tsc ]; then \
	  $(PKG_DIR)/node_modules/.bin/tsc --noEmit; echo "lint-types OK"; \
	else \
	  echo "lint-types skipped (no tsconfig.json or tsc not installed)"; \
	fi

.PHONY: test
test: ## Run every numbered example script; emit dist/test-results.tap (TAP format)
	@mkdir -p $(PKG_DIR)/dist
	@: > $(PKG_DIR)/dist/test-results.tap
	@total=0; passed=0; failed=0; \
	scripts=$$(ls $(PKG_DIR)/[0-9][0-9]-*.mjs 2>/dev/null | sort); \
	count=$$(echo "$$scripts" | wc -l | tr -d ' '); \
	echo "TAP version 13" >> $(PKG_DIR)/dist/test-results.tap; \
	echo "1..$$count" >> $(PKG_DIR)/dist/test-results.tap; \
	for f in $$scripts; do \
	  total=$$((total+1)); name=$$(basename $$f); \
	  echo "==> $$name"; \
	  if $(NODE) $$f > $(PKG_DIR)/dist/$${name}.out 2>&1; then \
	    passed=$$((passed+1)); \
	    echo "ok $$total - $$name" >> $(PKG_DIR)/dist/test-results.tap; \
	  else \
	    failed=$$((failed+1)); \
	    echo "not ok $$total - $$name" >> $(PKG_DIR)/dist/test-results.tap; \
	    echo "  ---" >> $(PKG_DIR)/dist/test-results.tap; \
	    sed 's/^/  /' $(PKG_DIR)/dist/$${name}.out >> $(PKG_DIR)/dist/test-results.tap; \
	    echo "  ..." >> $(PKG_DIR)/dist/test-results.tap; \
	  fi; \
	done; \
	echo "# tests $$total / passed $$passed / failed $$failed"; \
	if [ "$$failed" -gt 0 ]; then exit 1; fi
	@echo "all examples passed; results in dist/test-results.tap"

.PHONY: build
build: ## Tag the build (example dir produces no shippable artefact)
	@mkdir -p $(PKG_DIR)/dist
	@printf '{"built_at": "%s", "node": "%s", "kind": "examples-mjs"}\n' \
	  "$$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$$($(NODE) --version)" \
	  > $(PKG_DIR)/dist/build-stamp.json
	@echo "build stamp written: dist/build-stamp.json"

.PHONY: clean
clean: ## Remove generated artefacts
	@rm -rf $(PKG_DIR)/dist

.PHONY: distclean
distclean: clean ## Also remove node_modules
	@rm -rf $(PKG_DIR)/node_modules

.PHONY: parity
parity: ## Run mjs + py twin scripts and diff their normalized JSON
	@for f in $(sort $(wildcard $(PKG_DIR)/[0-9][0-9]-*.mjs)); do \
	  base=$$(basename $$f .mjs); pyf=$(REPO_ROOT)/examples/app-yaml-config/sdk/py/$$base.py; \
	  if [ ! -f $$pyf ]; then echo "skip $$base (no py twin)"; continue; fi; \
	  diff <($(NODE) $$f | $(JQ) -S .) <(python3 $$pyf | $(JQ) -S .) && echo "$$base parity OK" || echo "$$base parity FAIL"; \
	done

# ---------------------------------------------------------------------------
# CI aggregate
# ---------------------------------------------------------------------------

.PHONY: ci
ci: ci-install lint test build ## Full CI pipeline (install → lint → test → build)
