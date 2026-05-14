# packages/orchestrator/Makefile — pinned-version CI entry for the orchestration shell.
#
# Eight-target contract per <plan-tree>/ci/README.md. Delegates to the root
# Makefile for everything except the augmented `lint` and `test` targets,
# which add stricter checks (shellcheck on every script, actionlint on every
# workflow, golden bats tests).
#
# The plan-tree canonical version at <plan-tree>/ci/makefiles/orchestrator/
# Makefile references additional bats fixtures (emitters.bats, doctor.bats,
# build-fixture.sh) that are intentionally NOT yet shipped — they are the
# "more rigorous CI" promised by the canonical template, and tracked as
# stage-7 deferred follow-up. Until they land this Makefile delegates to
# the root for `test` so make-ci is still green.

SHELL          := /bin/bash
.SHELLFLAGS    := -eu -o pipefail -c
.DEFAULT_GOAL  := help

ROOT_DIR       ?= $(abspath $(CURDIR)/../..)
SHELLCHECK     ?= $(shell command -v shellcheck 2>/dev/null)
ACTIONLINT     ?= $(shell command -v actionlint 2>/dev/null)

.PHONY: help install ci-install lint test build clean ci print-env assert-root

help: ## Show targets (delegates to the root sectioned help)
	@$(MAKE) -C $(ROOT_DIR) help

print-env: ## Print resolved paths + tool availability
	@echo "ROOT_DIR   = $(ROOT_DIR)"
	@echo -n "shellcheck : "; [ -n "$(SHELLCHECK)" ] && $(SHELLCHECK) --version 2>/dev/null | head -2 | tail -1 || echo "(not installed; lint downgrades to bash -n)"
	@echo -n "actionlint : "; [ -n "$(ACTIONLINT)" ] && $(ACTIONLINT) -version 2>/dev/null | head -1 || echo "(not installed; workflow lint skipped)"

install: assert-root ## Install host-side deps (delegates to root)
	@$(MAKE) -C $(ROOT_DIR) install

ci-install: assert-root ## Deterministic CI install (delegates to root)
	@$(MAKE) -C $(ROOT_DIR) ci-install

lint: assert-root ## Augmented lint: subtree-lint + shellcheck + actionlint + root lint
	@set -euo pipefail; \
	$(MAKE) -C $(ROOT_DIR) subtree-lint; \
	if [ -n "$(SHELLCHECK)" ]; then \
	  echo "==> shellcheck"; \
	  $(SHELLCHECK) $(ROOT_DIR)/scripts/workspace/*.sh; \
	else \
	  echo "skip: shellcheck not installed"; \
	  for f in $(ROOT_DIR)/scripts/workspace/*.sh; do bash -n "$$f"; done; \
	fi; \
	if [ -n "$(ACTIONLINT)" ]; then \
	  echo "==> actionlint"; \
	  $(ACTIONLINT) $(ROOT_DIR)/.github/workflows/*.yml; \
	else \
	  echo "skip: actionlint not installed"; \
	fi; \
	echo "==> root lint (compose config validation)"; \
	$(MAKE) -C $(ROOT_DIR) lint

test: assert-root ## Test: bats skill suite + emitter idempotency check
	@set -euo pipefail; \
	echo "==> skill bats"; \
	$(MAKE) -C $(ROOT_DIR)/.claude/skills/local-workspace-bootstrap test; \
	echo "==> emitter idempotency (sha256)"; \
	a=$$($(ROOT_DIR)/scripts/workspace/emit-pnpm.sh >/dev/null && shasum -a 256 $(ROOT_DIR)/pnpm-workspace.yaml | awk '{print $$1}'); \
	b=$$($(ROOT_DIR)/scripts/workspace/emit-pnpm.sh >/dev/null && shasum -a 256 $(ROOT_DIR)/pnpm-workspace.yaml | awk '{print $$1}'); \
	[ "$$a" = "$$b" ] && echo "  pnpm-workspace.yaml: byte-identical re-emit" || (echo "REGRESSED"; exit 1); \
	echo "==> doctor"; \
	$(MAKE) -C $(ROOT_DIR) doctor

build: assert-root ## Build (delegates to root: `docker compose build`)
	@$(MAKE) -C $(ROOT_DIR) build

clean: assert-root ## Clean (delegates to root)
	@$(MAKE) -C $(ROOT_DIR) clean

ci: ci-install lint test build ## Full pipeline: ci-install → lint → test → build

assert-root:
	@if [ ! -f $(ROOT_DIR)/workspace.toml ]; then \
	  echo "FAIL: $(ROOT_DIR) has no workspace.toml"; \
	  echo "  set ROOT_DIR= to the orchestration shell"; \
	  exit 1; \
	fi
