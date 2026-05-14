# fastify-server examples — standalone runner
#
# Usage:
#   make up          # install deps + start in background (docker-compose-style)
#   make down        # stop background server + clear logs/pid
#   make install     # install deps (file:.. → parent fastify-server)
#   make start       # run quickstart in foreground on PORT (default 51000)
#   make dev         # run quickstart in foreground with --watch
#   make stop        # stop background server (PID → lsof → pkill)
#   make build-parent  # rebuild parent dist before running
#   make clean       # remove node_modules + lockfile + log/pid

SHELL       := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

NPM         ?= npm
NODE        ?= node
PARENT_DIR  := ..
EXAMPLE     ?= quickstart
ENTRY       := $(EXAMPLE)/main.mjs

PORT        ?= 51000
HOST        ?= 0.0.0.0
APP_ENV     ?= local
LOG_LEVEL   ?= info

PID_FILE    := .quickstart.pid
LOG_FILE    := .quickstart.log

RUN_ENV := PORT=$(PORT) HOST=$(HOST) APP_ENV=$(APP_ENV) LOG_LEVEL=$(LOG_LEVEL)

.PHONY: help install reinstall build-parent up down start start-bg stop dev clean check-port

help: ## Show available targets
	@awk 'BEGIN{FS=":.*##"; printf "\nTargets:\n"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install example deps (links parent via file:..)
	$(NPM) install

reinstall: clean install ## Wipe node_modules and reinstall

build-parent: ## Build parent fastify-server dist/
	$(MAKE) -C $(PARENT_DIR) build 2>/dev/null || (cd $(PARENT_DIR) && $(NPM) run build)

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
# fails only if a FOREIGN process still holds the port. Without this, a second
# `make up`/`make dev` fails with "port already in use" — the stale-bind dev-loop bug.
start-bg: stop check-port
	@test -f $(ENTRY) || (echo "✖ $(ENTRY) not found"; exit 1)
	$(RUN_ENV) $(NODE) $(ENTRY) > $(CURDIR)/$(LOG_FILE) 2>&1 & echo $$! > $(CURDIR)/$(PID_FILE)
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
	@pkill -f "node.*$(ENTRY)" 2>/dev/null || true

start: stop check-port ## Run example in foreground (PORT=$(PORT))
	@test -f $(ENTRY) || (echo "✖ $(ENTRY) not found"; exit 1)
	$(RUN_ENV) $(NODE) $(ENTRY)

dev: stop check-port ## Run example in foreground with --watch
	@test -f $(ENTRY) || (echo "✖ $(ENTRY) not found"; exit 1)
	$(RUN_ENV) $(NODE) --watch $(ENTRY)

clean: ## Remove node_modules, lockfile, and log/pid files
	rm -rf node_modules package-lock.json
	rm -f $(LOG_FILE) $(PID_FILE)
