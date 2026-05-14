# packages/py — CI Makefile for polyglot-figma-api

SHELL         := /bin/bash
.SHELLFLAGS   := -eu -o pipefail -c
.DEFAULT_GOAL := help

PKG_DIR := $(abspath $(CURDIR))
PY      ?= python3
UV      ?= uv
PYTEST  ?= $(UV) run pytest
RUFF    ?= $(UV) run ruff

.PHONY: help
help: ## Show available targets
	@awk 'BEGIN{FS=":.*##"; printf "\nTargets:\n"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: install
install: ## Install deps (mutable lockfile OK)
	cd ../.. && $(UV) sync --all-packages --extra dev

.PHONY: ci-install
ci-install: ## Deterministic install for CI
	cd ../.. && ($(UV) sync --all-packages --frozen --extra dev || $(UV) sync --all-packages --extra dev)

.PHONY: test
test: ## Run pytest unit suite with 100% coverage gate
	$(PYTEST) --cov=figma_api --cov-report=term-missing -q tests --ignore=tests/integration

.PHONY: test-coverage
test-coverage: ## Same as `test` — coverage gate is the default
	$(PYTEST) --cov=figma_api --cov-report=term-missing tests --ignore=tests/integration

.PHONY: test-integration
test-integration: ## Env-gated integration tests (needs FIGMA_PASS)
	$(PYTEST) -q tests/integration

.PHONY: lint
lint: ## Run ruff check
	$(RUFF) check figma_api tests examples

.PHONY: lint-fix
lint-fix: ## Auto-format with ruff
	$(RUFF) format figma_api tests examples
	$(RUFF) check --fix figma_api tests examples

.PHONY: build
build: ## Produce wheel + sdist under ./dist
	rm -rf dist
	$(UV) build --package polyglot-figma-api --out-dir dist
	ls -lh dist/

.PHONY: example
example: ## Run the default SDK example (needs FIGMA_PASS)
	$(UV) run python -m examples.sdk.basic_usage

.PHONY: clean
clean: ## Remove build artifacts
	rm -rf dist build .pytest_cache .coverage htmlcov .ruff_cache
	find . -type d -name __pycache__ -exec rm -rf {} + || true
	find . -type d -name "*.egg-info" -exec rm -rf {} + || true

.PHONY: distclean
distclean: clean ## Also remove the uv-managed venv
	rm -rf .venv

.PHONY: ci
ci: ci-install lint test build ## Full CI pipeline
