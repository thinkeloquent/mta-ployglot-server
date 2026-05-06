# server-integration — CI Makefile (HTTP smoke against mta-ployglot-server)
#
# Brings the dev stack up via the repo-root `make dev`, runs the curl-based
# smoke targets for both `/healthz/app-yaml/{intent}` and the new
# `/api/runtime-app-config/endpoints/refresh` route, then tears the stack down.

SHELL          := /bin/bash
.SHELLFLAGS    := -eu -o pipefail -c
.DEFAULT_GOAL  := help

PKG_DIR        := $(abspath $(CURDIR))
REPO_ROOT      := $(abspath $(PKG_DIR)/../../..)
FASTIFY_PORT   ?= 5100
FASTAPI_PORT   ?= 5200
CURL           := curl --silent --show-error --fail-with-body

# ---------------------------------------------------------------------------
# meta
# ---------------------------------------------------------------------------

.PHONY: help
help: ## Show available targets
	@awk 'BEGIN{FS=":.*##"; printf "\nTargets:\n"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: print-env
print-env: ## Print resolved variables (debug)
	@echo "fastify port : $(FASTIFY_PORT)"
	@echo "fastapi port : $(FASTAPI_PORT)"
	@echo "repo root    : $(REPO_ROOT)"

# ---------------------------------------------------------------------------
# lifecycle
# ---------------------------------------------------------------------------

.PHONY: install
install: ## No-op (uses repo-root make dev for actual install)
	@echo "no per-package install — use repo-root 'make dev'"

.PHONY: ci-install
ci-install: install ## Same as install for this artefact

.PHONY: lint
lint: ## Validate that the curl helper is available
	@command -v curl >/dev/null || (echo "curl missing"; exit 1)
	@command -v jq   >/dev/null || (echo "jq missing"; exit 1)

.PHONY: dev-up
dev-up: ## Bring the dev stack up (repo-root make dev)
	@$(MAKE) -C $(REPO_ROOT) dev-stop || true
	@$(MAKE) -C $(REPO_ROOT) dev
	@sleep 5

.PHONY: dev-down
dev-down: ## Tear the dev stack down
	@$(MAKE) -C $(REPO_ROOT) dev-stop

.PHONY: smoke-healthz
smoke-healthz: ## Curl /healthz/app-yaml/* on both runtimes; write dist/smoke-healthz.json
	@mkdir -p $(PKG_DIR)/dist
	@{ \
	  printf '{"timestamp": "%s", "results": [' "$$(date -u +%Y-%m-%dT%H:%M:%SZ)"; \
	  first=1; \
	  for runtime in fastify:$(FASTIFY_PORT) fastapi:$(FASTAPI_PORT); do \
	    name=$${runtime%%:*}; port=$${runtime##*:}; \
	    for intent in llm001 agents001 nonexistent_intent; do \
	      [ $$first -eq 0 ] && printf ','; first=0; \
	      code=$$(curl -s -o /tmp/healthz-body -w '%{http_code}' "http://127.0.0.1:$$port/healthz/app-yaml/$$intent"); \
	      printf '{"runtime":"%s","intent":"%s","status":%s,"body":%s}' "$$name" "$$intent" "$$code" "$$(jq -c -R 'try fromjson catch .' < /tmp/healthz-body)"; \
	    done; \
	  done; \
	  printf ']}\n'; \
	} > $(PKG_DIR)/dist/smoke-healthz.json
	@jq -e 'all(.results[]; .runtime == "fastify" or .runtime == "fastapi")' $(PKG_DIR)/dist/smoke-healthz.json >/dev/null
	@jq -e '[.results[] | select(.intent == "llm001") | .status] | all(. == 200)' $(PKG_DIR)/dist/smoke-healthz.json >/dev/null \
	  && echo "smoke-healthz OK (results in dist/smoke-healthz.json)"

.PHONY: smoke-refresh
smoke-refresh: ## Curl POST /api/runtime-app-config/endpoints/refresh on both runtimes
	@mkdir -p $(PKG_DIR)/dist
	@{ \
	  printf '{"timestamp": "%s", "results": [' "$$(date -u +%Y-%m-%dT%H:%M:%SZ)"; \
	  first=1; \
	  for runtime in fastify:$(FASTIFY_PORT) fastapi:$(FASTAPI_PORT); do \
	    name=$${runtime%%:*}; port=$${runtime##*:}; \
	    [ $$first -eq 0 ] && printf ','; first=0; \
	    code=$$(curl -s -o /tmp/refresh-body -w '%{http_code}' -X POST "http://127.0.0.1:$$port/api/runtime-app-config/endpoints/refresh"); \
	    printf '{"runtime":"%s","status":%s,"body":%s}' "$$name" "$$code" "$$(jq -c . < /tmp/refresh-body 2>/dev/null || echo null)"; \
	  done; \
	  printf ']}\n'; \
	} > $(PKG_DIR)/dist/smoke-refresh.json
	@jq -e '[.results[].status] | all(. == 200)' $(PKG_DIR)/dist/smoke-refresh.json >/dev/null \
	  && echo "smoke-refresh OK (results in dist/smoke-refresh.json)"

.PHONY: smoke-compute
smoke-compute: ## Curl GET /api/runtime-app-config/compute-functions on both runtimes
	@mkdir -p $(PKG_DIR)/dist
	@for runtime in fastify:$(FASTIFY_PORT) fastapi:$(FASTAPI_PORT); do \
	  name=$${runtime%%:*}; port=$${runtime##*:}; \
	  $(CURL) "http://127.0.0.1:$$port/api/runtime-app-config/compute-functions" | jq -e '.ok and (.count > 0)' > $(PKG_DIR)/dist/smoke-compute-$$name.json; \
	done
	@echo "smoke-compute OK"

.PHONY: test
test: dev-up smoke-healthz smoke-refresh dev-down ## Full HTTP smoke + lifecycle stack
# smoke-compute deferred — depends on the compute-functions introspection route from
# story 03/01 task 06 which was not implemented in this pass (intentional scope cut).

.PHONY: build
build: ## Tag the smoke run
	@mkdir -p $(PKG_DIR)/dist
	@printf '{"built_at": "%s", "kind": "server-integration"}\n' \
	  "$$(date -u +%Y-%m-%dT%H:%M:%SZ)" > $(PKG_DIR)/dist/build-stamp.json

.PHONY: clean
clean: ## Remove generated artefacts
	@rm -rf $(PKG_DIR)/dist

# ---------------------------------------------------------------------------
# CI aggregate
# ---------------------------------------------------------------------------

.PHONY: ci
ci: ci-install lint test build ## Full CI pipeline
