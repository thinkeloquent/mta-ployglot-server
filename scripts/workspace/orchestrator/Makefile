# scripts/workspace/orchestrator — CI Makefile
#
# Shell-helper package. Lints every .sh with shellcheck and runs the bats
# suite under tests/. No build artifact (shell only). `make ci` is the
# single command CI runs.

SHELL          := /bin/bash
.SHELLFLAGS    := -eu -o pipefail -c
.DEFAULT_GOAL  := help

PKG_DIR        := $(abspath $(CURDIR))
SHELLCHECK     := $(shell command -v shellcheck 2>/dev/null)
BATS           := $(shell command -v bats 2>/dev/null)

# All shell scripts under this package, excluding fixtures.
SH_FILES       := $(shell find $(PKG_DIR) -type f -name '*.sh' -not -path '*/tests/fixtures/*' 2>/dev/null)
BATS_FILES     := $(shell find $(PKG_DIR)/tests -type f -name '*.bats' 2>/dev/null)

# ---------------------------------------------------------------------------
# meta
# ---------------------------------------------------------------------------

.PHONY: help
help: ## Show available targets
	@awk 'BEGIN{FS=":.*##"; printf "\nTargets:\n"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: print-env
print-env: ## Print tool versions (debug)
	@echo "pkg-dir    : $(PKG_DIR)"
	@echo "shellcheck : $(SHELLCHECK) $$($(SHELLCHECK) --version 2>/dev/null | grep version: || true)"
	@echo "bats       : $(BATS) $$($(BATS) --version 2>/dev/null || true)"
	@echo "sh-files   : $(words $(SH_FILES))"
	@echo "bats-files : $(words $(BATS_FILES))"

# ---------------------------------------------------------------------------
# lifecycle
# ---------------------------------------------------------------------------

.PHONY: install
install: ## Install dev dependencies (bats, shellcheck)
	@if [ -z "$(SHELLCHECK)" ]; then \
	  echo "→ installing shellcheck"; \
	  if command -v brew >/dev/null; then brew install shellcheck; \
	  elif command -v apt-get >/dev/null; then sudo apt-get install -y shellcheck; \
	  else echo "Install shellcheck manually: https://github.com/koalaman/shellcheck"; exit 1; \
	  fi; \
	fi
	@if [ -z "$(BATS)" ]; then \
	  echo "→ installing bats-core"; \
	  if command -v brew >/dev/null; then brew install bats-core; \
	  elif command -v npm >/dev/null; then npm install -g bats; \
	  else echo "Install bats-core manually: https://github.com/bats-core/bats-core"; exit 1; \
	  fi; \
	fi
	@echo "✓ dev deps installed"

.PHONY: ci-install
ci-install: ## Deterministic install for CI (uses install; CI image should pre-install)
	@if [ -z "$(SHELLCHECK)" ] || [ -z "$(BATS)" ]; then \
	  echo "ERROR: shellcheck and bats must be pre-installed in CI image" >&2; \
	  exit 1; \
	fi
	@echo "✓ dev deps verified"

.PHONY: lint
lint: ## shellcheck every .sh under the package
	@if [ -z "$(SH_FILES)" ]; then echo "no .sh files to lint"; exit 0; fi
	@echo "→ shellcheck $(words $(SH_FILES)) files"
	@$(SHELLCHECK) -x $(SH_FILES)
	@echo "✓ lint clean"

.PHONY: test
test: ## Run the bats suite under tests/
	@if [ -z "$(BATS_FILES)" ]; then echo "no .bats files to run"; exit 0; fi
	@echo "→ bats $(words $(BATS_FILES)) suite(s)"
	@$(BATS) $(BATS_FILES)
	@echo "✓ tests passed"

.PHONY: build
build: ## No-op (shell-only package)
	@echo "no build artifact (shell-only)"

.PHONY: clean
clean: ## Remove transient test artifacts
	@rm -rf $(PKG_DIR)/tests/.bats_cache/
	@find $(PKG_DIR) -name '*.tmp' -delete 2>/dev/null || true
	@echo "✓ clean"

.PHONY: distclean
distclean: clean ## Same as clean (no installed deps to remove)
	@true

# ---------------------------------------------------------------------------
# CI aggregate
# ---------------------------------------------------------------------------

.PHONY: ci
ci: ci-install lint test build ## Full CI pipeline (verify deps → lint → test → build)
