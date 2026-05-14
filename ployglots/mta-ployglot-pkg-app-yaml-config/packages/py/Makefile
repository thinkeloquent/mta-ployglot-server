# packages/py — CI Makefile

SHELL          := /bin/bash
.SHELLFLAGS    := -eu -o pipefail -c
.DEFAULT_GOAL  := help

PKG_DIR        := $(abspath $(CURDIR))
VENV           := $(PKG_DIR)/.venv
HOST_PY        ?= python3
PY             := $(VENV)/bin/python
PIP            := $(VENV)/bin/pip
PYTEST         := $(VENV)/bin/pytest
UV             ?= uv

.PHONY: help
help: ## Show available targets
	@awk 'BEGIN{FS=":.*##"; printf "\nTargets:\n"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: print-env
print-env: ## Print tool versions
	@echo "pkg-dir : $(PKG_DIR)"
	@$(HOST_PY) --version

$(VENV)/bin/activate:
	@$(HOST_PY) -m venv $(VENV)
	@$(VENV)/bin/pip install --upgrade pip >/dev/null

.PHONY: venv
venv: $(VENV)/bin/activate ## Create local .venv

.PHONY: install
install: venv ## Install in editable mode (base only; loader extra is opt-in)
	@$(PIP) install -e .

.PHONY: install-with-loader
install-with-loader: venv ## Install with the optional [loader] extra
	@$(PIP) install -e .[loader]

.PHONY: ci-install
ci-install: venv ## Deterministic install (base + dev extras)
	@$(PIP) install -e .[dev]

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
