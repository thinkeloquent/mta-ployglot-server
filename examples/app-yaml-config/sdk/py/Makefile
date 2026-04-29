# examples-py — CI Makefile (Python SDK example runner)
#
# Installs the four app-yaml-chain Python SDKs from the local sibling repos
# (editable installs into a per-dir .venv), then runs every numbered example
# script in order.

SHELL          := /bin/bash
.SHELLFLAGS    := -eu -o pipefail -c
.DEFAULT_GOAL  := help

PKG_DIR        := $(abspath $(CURDIR))
REPO_ROOT      := $(abspath $(PKG_DIR)/../../../..)
SIBLINGS_ROOT  := $(REPO_ROOT)/ployglots
UV             ?= uv
PYTHON         ?= python3
JQ             ?= jq

VENV           := $(PKG_DIR)/.venv
PIP            := $(VENV)/bin/pip
PY             := $(VENV)/bin/python

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
	@$(UV)     --version 2>/dev/null || echo "uv missing"
	@$(PYTHON) --version

# ---------------------------------------------------------------------------
# lifecycle
# ---------------------------------------------------------------------------

$(VENV):
	@if command -v $(UV) >/dev/null; then $(UV) venv $(VENV); else $(PYTHON) -m venv $(VENV); fi

# Pip vs uv: a uv-created venv has no pip; install editable via `uv pip install -e <path> --python <venv>`.
INSTALL_EDITABLE = $(if $(shell command -v $(UV) 2>/dev/null),$(UV) pip install --python $(PY) -e,$(PIP) install -e)

.PHONY: install
install: $(VENV) ## Install dependencies + editable sibling packages
	@$(MAKE) install-siblings

.PHONY: ci-install
ci-install: $(VENV) ## Deterministic install for CI
	@$(MAKE) install-siblings

.PHONY: install-siblings
install-siblings: ## Editable install of the four py SDKs from siblings
	@$(INSTALL_EDITABLE) $(SIBLINGS_ROOT)/mta-ployglot-pkg-app-yaml-config/packages/py
	@$(INSTALL_EDITABLE) $(SIBLINGS_ROOT)/mta-ployglot-pkg-app-yaml-loader/packages/py
	@$(INSTALL_EDITABLE) $(SIBLINGS_ROOT)/mta-ployglot-pkg-app-yaml-overwrite/packages/engine-py
	@$(INSTALL_EDITABLE) $(SIBLINGS_ROOT)/mta-ployglot-pkg-app-yaml-overwrite/packages/applier-py
	@$(INSTALL_EDITABLE) $(SIBLINGS_ROOT)/mta-ployglot-pkg-app-yaml-fetch-config/packages/py

.PHONY: lint
lint: lint-syntax lint-style lint-types ## Static checks: py_compile + ruff (if available) + mypy (if available)

.PHONY: lint-syntax
lint-syntax: ## py_compile every example script
	@for f in $(PKG_DIR)/[0-9][0-9]-*.py; do $(PY) -m py_compile $$f; done
	@echo "lint-syntax OK"

.PHONY: lint-style
lint-style: ## ruff check (skipped if ruff missing)
	@if command -v $(VENV)/bin/ruff >/dev/null || command -v ruff >/dev/null; then \
	  ($(VENV)/bin/ruff check $(PKG_DIR) 2>/dev/null || ruff check $(PKG_DIR)) && echo "lint-style OK"; \
	else echo "lint-style skipped (ruff not installed)"; fi

.PHONY: lint-types
lint-types: ## mypy on every example (showcase scripts; --strict relaxed)
	@if [ -x $(VENV)/bin/mypy ]; then \
	  $(VENV)/bin/mypy --ignore-missing-imports $(PKG_DIR)/[0-9][0-9]-*.py && echo "lint-types OK"; \
	elif command -v mypy >/dev/null; then \
	  mypy --ignore-missing-imports $(PKG_DIR)/[0-9][0-9]-*.py && echo "lint-types OK"; \
	else echo "lint-types skipped (mypy not installed)"; fi

.PHONY: test
test: ## Run every numbered example script; emit dist/junit.xml + dist/<script>.out
	@mkdir -p $(PKG_DIR)/dist
	@total=0; passed=0; failed=0; ts=$$(date -u +%Y-%m-%dT%H:%M:%SZ); \
	scripts=$$(ls $(PKG_DIR)/[0-9][0-9]-*.py 2>/dev/null | sort); \
	count=$$(echo "$$scripts" | wc -l | tr -d ' '); \
	{ \
	  echo '<?xml version="1.0" encoding="UTF-8"?>'; \
	  echo '<testsuites name="examples-py" tests="'$$count'" timestamp="'$$ts'">'; \
	  echo '<testsuite name="examples-py" tests="'$$count'">'; \
	  for f in $$scripts; do \
	    total=$$((total+1)); name=$$(basename $$f .py); \
	    echo "==> $$name" 1>&2; \
	    if $(PY) $$f > $(PKG_DIR)/dist/$${name}.out 2>&1; then \
	      passed=$$((passed+1)); \
	      echo '<testcase classname="examples-py" name="'$$name'"/>'; \
	    else \
	      failed=$$((failed+1)); \
	      echo '<testcase classname="examples-py" name="'$$name'">'; \
	      echo '<failure message="non-zero exit"><![CDATA['; \
	      cat $(PKG_DIR)/dist/$${name}.out; \
	      echo ']]></failure></testcase>'; \
	    fi; \
	  done; \
	  echo '</testsuite></testsuites>'; \
	} > $(PKG_DIR)/dist/junit.xml; \
	echo "# tests $$total / passed $$passed / failed $$failed"; \
	if [ "$$failed" -gt 0 ]; then exit 1; fi
	@echo "all examples passed; results in dist/junit.xml"

.PHONY: build
build: ## Tag the build
	@mkdir -p $(PKG_DIR)/dist
	@printf '{"built_at": "%s", "python": "%s", "kind": "examples-py"}\n' \
	  "$$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$$($(PY) --version)" \
	  > $(PKG_DIR)/dist/build-stamp.json
	@echo "build stamp written: dist/build-stamp.json"

.PHONY: clean
clean: ## Remove generated artefacts
	@rm -rf $(PKG_DIR)/dist $(PKG_DIR)/__pycache__

.PHONY: distclean
distclean: clean ## Also remove .venv
	@rm -rf $(VENV)

.PHONY: parity
parity: ## Run py + mjs twin scripts and diff their normalized JSON
	@for f in $(sort $(wildcard $(PKG_DIR)/[0-9][0-9]-*.py)); do \
	  base=$$(basename $$f .py); mjsf=$(REPO_ROOT)/examples/app-yaml-config/sdk/mjs/$$base.mjs; \
	  if [ ! -f $$mjsf ]; then echo "skip $$base (no mjs twin)"; continue; fi; \
	  diff <($(PY) $$f | $(JQ) -S .) <(node $$mjsf | $(JQ) -S .) && echo "$$base parity OK" || echo "$$base parity FAIL"; \
	done

# ---------------------------------------------------------------------------
# CI aggregate
# ---------------------------------------------------------------------------

.PHONY: ci
ci: ci-install lint test build ## Full CI pipeline (install → lint → test → build)
