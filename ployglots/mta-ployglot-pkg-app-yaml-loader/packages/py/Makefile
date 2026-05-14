# packages/py — CI Makefile

SHELL          := /bin/bash
.SHELLFLAGS    := -eu -o pipefail -c
.DEFAULT_GOAL  := help

PKG_DIR        := $(abspath $(CURDIR))
PY             ?= python3
PIP            ?= $(PY) -m pip
PYTEST         ?= $(PY) -m pytest
UV             ?= uv

.PHONY: help
help: ## Show available targets
	@awk 'BEGIN{FS=":.*##"; printf "\nTargets:\n"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: print-env
print-env: ## Print tool versions
	@echo "pkg-dir : $(PKG_DIR)"
	@$(PY) --version

.PHONY: install
install: ## Install in editable mode
	@$(PIP) install -e .

.PHONY: ci-install
ci-install: ## Deterministic install
	@if command -v $(UV) >/dev/null 2>&1; then $(UV) sync --frozen || $(UV) pip install -e .; else $(PIP) install -e .; fi

.PHONY: test
test: ## Run the test suite
	@$(PYTEST) tests

.PHONY: lint
lint: ## Static checks
	@$(PY) -m compileall -q src

.PHONY: build
build: ## Produce wheel + sdist under dist/
	@rm -rf dist
	@$(PY) -m build

.PHONY: clean
clean: ## Remove generated artifacts
	@rm -rf dist build *.egg-info
	@find . -type d -name __pycache__ -prune -exec rm -rf {} +

.PHONY: distclean
distclean: clean ## Also remove .venv
	@rm -rf .venv

.PHONY: ci
ci: ci-install lint test build ## Full CI pipeline
