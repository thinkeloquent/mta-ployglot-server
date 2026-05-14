# packages/py — CI Makefile
#
# Thin wrapper around uv/python for local + CI parity. `make ci` is the
# single command CI runs.

SHELL          := /bin/bash
.SHELLFLAGS    := -eu -o pipefail -c
.DEFAULT_GOAL  := help

PKG_DIR        := $(abspath $(CURDIR))
UV             ?= uv

.PHONY: help
help: ## Show available targets
	@awk 'BEGIN{FS=":.*##"; printf "\nTargets:\n"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: print-env
print-env: ## Print tool versions (debug)
	@echo "pkg-dir : $(PKG_DIR)"
	@python3 --version
	@$(UV) --version

.PHONY: install
install: ## Install dependencies (mutable lockfile)
	@$(UV) sync --extra dev

.PHONY: ci-install
ci-install: ## Deterministic install for CI (frozen lockfile)
	@$(UV) sync --frozen --extra dev

.PHONY: lint
lint: ## Mypy + ruff
	@$(UV) run mypy polyglot_aws_s3
	@$(UV) run ruff check polyglot_aws_s3

.PHONY: test
test: ## Run pytest (config + client builder)
	@$(UV) run pytest -q

.PHONY: test-watch
test-watch: ## Re-run tests on change (requires pytest-watch)
	@$(UV) run ptw -- -q

.PHONY: build
build: ## Build sdist + wheel
	@rm -rf dist
	@$(UV) build

.PHONY: clean
clean: ## Remove generated artifacts
	@rm -rf dist .pytest_cache .mypy_cache .ruff_cache
	@find . -type d -name __pycache__ -prune -exec rm -rf {} +

.PHONY: distclean
distclean: clean ## Also remove installed deps
	@rm -rf .venv

.PHONY: ci
ci: ci-install lint test build ## Full CI pipeline
