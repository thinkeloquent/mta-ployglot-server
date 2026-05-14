SHELL := /bin/bash
.DEFAULT_GOAL := help

PKG := fetch_http_client
PY  := $(shell command -v uv 2>/dev/null && echo uv run python || echo python)
PIP_RUN := $(shell command -v uv 2>/dev/null >/dev/null && echo "uv pip" || echo "python -m pip")
PYTEST := $(shell command -v uv 2>/dev/null >/dev/null && echo "uv run pytest" || echo "python -m pytest")
RUFF := $(shell command -v uv 2>/dev/null >/dev/null && echo "uv run ruff" || echo "python -m ruff")

.PHONY: help
help:  ## Show available targets.
	@awk 'BEGIN { FS = ":.*?## " } /^[a-zA-Z_-]+:.*## / { printf "  %-16s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

.PHONY: install
install:  ## Install package + dev extras (editable).
	$(PIP_RUN) install -e ".[dev]"

.PHONY: ci-install
ci-install:  ## Install for CI (pinned, no extras rebuild).
	$(PIP_RUN) install -e ".[dev]"

.PHONY: test
test:  ## Run unit tests with 100% coverage gate.
	$(PYTEST) -v tests/ --ignore=tests/integration \
		--cov=fetch_http_client --cov-report=term-missing --cov-fail-under=100

.PHONY: test-nocov
test-nocov:  ## Run unit tests without coverage (faster for iteration).
	$(PYTEST) -v tests/ --ignore=tests/integration

.PHONY: test-integration
test-integration:  ## Run integration tests (env-gated; skipped when vars missing).
	$(PYTEST) -v tests/integration

.PHONY: test-watch
test-watch:  ## Watch mode (requires pytest-watch).
	$(PYTEST) -v tests/ --ignore=tests/integration -f

.PHONY: lint
lint:  ## Lint with ruff.
	$(RUFF) check $(PKG) tests examples
	$(RUFF) format --check $(PKG) tests examples

.PHONY: format
format:  ## Auto-format with ruff.
	$(RUFF) format $(PKG) tests examples
	$(RUFF) check --fix $(PKG) tests examples

.PHONY: build
build:  ## Build wheel + sdist.
	$(PY) -m build

.PHONY: pack
pack: build  ## Alias for build.

.PHONY: clean
clean:  ## Remove build artifacts + caches.
	rm -rf build/ dist/ *.egg-info .pytest_cache .ruff_cache .coverage coverage.xml
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

.PHONY: distclean
distclean: clean  ## Remove venv and all caches.
	rm -rf .venv node_modules

.PHONY: ci
ci: ci-install lint test  ## Full CI pipeline: install, lint, test.
