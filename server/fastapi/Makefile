# server/fastapi — standalone Poetry runner that extends the bootstrap
#
# Usage:
#   make up          # poetry install + start in background (docker-compose-style)
#   make down        # stop background server + clear logs/pid
#   make install     # poetry install (pulls parent fastapi-server via path dep)
#   make start       # run in foreground on PORT (default 52000)
#   make dev         # run with uvicorn --reload (uses build_app factory)
#   make stop        # stop background server (PID → lsof → pkill)
#   make shell       # drop into the poetry venv shell
#   make clean       # remove .venv + poetry.lock + log/pid

SHELL       := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

POETRY      ?= poetry
PYTHON      ?= python3.11

ENTRY       := main.py
APP_FACTORY := main:build_app

PORT        ?= 52000
HOST        ?= 0.0.0.0
APP_ENV     ?= local
LOG_LEVEL   ?= info

PID_FILE    := .quickstart.pid
LOG_FILE    := .quickstart.log

# Sibling source roots watched by uvicorn --reload-dir in `dev` (mirrors the
# platform reference Makefile's --reload-dir packages_py / polyglot / common
# pattern). Computed once so the `dev` recipe stays a single line of flags.
ROOT_DIR    := $(abspath $(CURDIR)/../..)
PLOYGLOTS   := $(ROOT_DIR)/ployglots
RELOAD_DIRS := \
  $(PLOYGLOTS)/mta-ployglot-server-bootstrap/fastapi_server \
  $(PLOYGLOTS)/mta-ployglot-server-print-routes/packages/py \
  $(PLOYGLOTS)/mta-ployglot-pkg-fetch-client/packages/py \
  $(PLOYGLOTS)/mta-ployglot-pkg-env-resolve/packages/py \
  $(PLOYGLOTS)/mta-ployglot-pkg-app-yaml-loader/packages/py \
  $(PLOYGLOTS)/mta-ployglot-pkg-app-yaml-overwrite/packages/engine-py \
  $(PLOYGLOTS)/mta-ployglot-pkg-app-yaml-overwrite/packages/applier-py \
  $(PLOYGLOTS)/mta-ployglot-pkg-app-yaml-config/packages/py \
  $(PLOYGLOTS)/mta-ployglot-pkg-app-yaml-fetch-config/packages/py

DEV_LOG_DIR ?= $(ROOT_DIR)/.dev
DEV_LOG     := $(DEV_LOG_DIR)/fastapi.log

RUN_ENV := PORT=$(PORT) HOST=$(HOST) APP_ENV=$(APP_ENV) LOG_LEVEL=$(LOG_LEVEL) POLYGLOT_DEBUG=1

.PHONY: help install reinstall up down start start-bg stop dev shell clean check-port check-poetry

help: ## Show available targets
	@awk 'BEGIN{FS=":.*##"; printf "\nTargets:\n"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

check-poetry: ## Verify poetry is installed
	@command -v $(POETRY) >/dev/null 2>&1 || { \
		echo "✖ poetry not found. Install: https://python-poetry.org/docs/#installation"; \
		echo "  Or use pipx: pipx install poetry"; \
		exit 1; \
	}

install: check-poetry ## Install deps (parent fastapi-server via path)
	$(POETRY) install

reinstall: clean install ## Wipe venv and reinstall

check-port: ## Fail if $(PORT) is already in use
	@if lsof -iTCP:$(PORT) -sTCP:LISTEN -nP >/dev/null 2>&1; then \
		echo "✖ port $(PORT) already in use"; \
		lsof -iTCP:$(PORT) -sTCP:LISTEN -nP; \
		exit 1; \
	fi

up: install start-bg ## Bring stack up: install deps + start in background
	@echo ""
	@echo "  Stack up.  Logs: $(LOG_FILE)  PID: $$(cat $(PID_FILE) 2>/dev/null || echo '?')"
	@echo "  → http://$(HOST):$(PORT)"
	@echo "  Use 'make down' to tear down, 'tail -f $(LOG_FILE)' to follow logs."
	@echo ""

# Port-cleanup invariant: stop runs first to clear OUR stale bind, then check-port
# fails only if a FOREIGN process still holds the port.
start-bg: check-poetry stop check-port
	@test -f $(ENTRY) || (echo "✖ $(ENTRY) not found"; exit 1)
	$(RUN_ENV) $(POETRY) run $(PYTHON) $(ENTRY) > $(CURDIR)/$(LOG_FILE) 2>&1 & echo $$! > $(CURDIR)/$(PID_FILE)
	@sleep 1

down: stop ## Bring stack down: stop server and clear ephemeral logs/pid
	@rm -f $(LOG_FILE) $(PID_FILE)
	@echo "Stack down."

stop: ## Stop background server (PID → lsof → pkill) — safe to call any time
	@if [ -f $(PID_FILE) ]; then \
		kill $$(cat $(PID_FILE)) 2>/dev/null || true; \
		rm -f $(PID_FILE); \
	fi
	@lsof -ti:$(PORT) | xargs kill 2>/dev/null || true
	@pkill -f "python.*$(ENTRY)" 2>/dev/null || true
	@pkill -f "uvicorn.*$(APP_FACTORY)" 2>/dev/null || true

start: check-poetry stop check-port ## Run in foreground via main.py (PORT=$(PORT))
	@test -f $(ENTRY) || (echo "✖ $(ENTRY) not found"; exit 1)
	$(RUN_ENV) $(POETRY) run $(PYTHON) $(ENTRY)

dev: check-poetry stop check-port ## Run with uvicorn --reload (factory mode); watches in-tree sources + every ployglots/ sibling
	@mkdir -p $(DEV_LOG_DIR)
	@$(RUN_ENV) $(POETRY) run uvicorn $(APP_FACTORY) \
		--factory --reload \
		--host $(HOST) --port $(PORT) \
		--log-level $(LOG_LEVEL) \
		--reload-dir . \
		$(foreach d,$(RELOAD_DIRS),$(if $(wildcard $(d)),--reload-dir $(d))) \
		--reload-include '*.py' \
		2>&1 | tee $(DEV_LOG)

shell: check-poetry ## Open a shell inside the poetry venv
	$(POETRY) shell

clean: ## Remove poetry.lock, in-project venv, and log/pid files
	rm -rf poetry.lock .venv
	rm -f $(LOG_FILE) $(PID_FILE)

.PHONY: test-integration-config-echo
test-integration-config-echo: ## Run integration tests for /healthz/integrations/* config_used field
	@$(POETRY) run pytest -v tests/integrations/test_integration_config_echo.py
