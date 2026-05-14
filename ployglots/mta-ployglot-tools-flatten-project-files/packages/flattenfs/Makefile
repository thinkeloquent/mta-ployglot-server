# packages/flattenfs — CI Makefile
#
# Thin wrapper around `cargo` for local + CI parity. Every target is
# idempotent and safe to re-run. `make ci` is the single command CI runs.

SHELL          := /bin/bash
.SHELLFLAGS    := -eu -o pipefail -c
.DEFAULT_GOAL  := help

PKG_DIR        := $(abspath $(CURDIR))
CARGO          ?= cargo
RUSTC          ?= rustc

# ---------------------------------------------------------------------------
# meta
# ---------------------------------------------------------------------------

.PHONY: help
help: ## Show available targets
	@awk 'BEGIN{FS=":.*##"; printf "\nTargets:\n"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: print-env
print-env: ## Print tool versions (debug)
	@echo "pkg-dir : $(PKG_DIR)"
	@echo "rustc   : $$($(RUSTC) --version)"
	@echo "cargo   : $$($(CARGO) --version)"
	@echo "clippy  : $$($(CARGO) clippy --version 2>/dev/null || echo 'not installed')"
	@echo "fmt     : $$($(CARGO) fmt --version 2>/dev/null || echo 'not installed')"

# ---------------------------------------------------------------------------
# lifecycle
# ---------------------------------------------------------------------------

.PHONY: install
install: ## Install dependencies (mutable lockfile OK)
	@$(CARGO) fetch

.PHONY: ci-install
ci-install: ## Deterministic install for CI (frozen lockfile)
	@$(CARGO) fetch --locked

.PHONY: test
test: ## Run the package test suite (unit + integration + doctests)
	@$(CARGO) test --all-targets --all-features
	@$(CARGO) test --doc

.PHONY: lint
lint: ## Static checks (fmt --check + clippy with warnings-as-errors)
	@$(CARGO) fmt --all -- --check
	@$(CARGO) clippy --all-targets --all-features -- -D warnings

.PHONY: build
build: ## Produce the distributable binary under ./target/release/
	@$(CARGO) build --release

.PHONY: clean
clean: ## Remove generated artifacts
	@$(CARGO) clean

.PHONY: distclean
distclean: clean ## Also remove lockfile and cargo caches
	@rm -rf Cargo.lock target/

# ---------------------------------------------------------------------------
# CI aggregates
# ---------------------------------------------------------------------------

.PHONY: ci
ci: ci-install lint test build ## Full CI pipeline (install → lint → test → build)

.PHONY: examples
examples: build ## Run all examples against the fixture tree (smoke test)
	@set -eu; \
	 OUT=$$(mktemp -d); \
	 echo "sdk_basic..."; \
	 $(CARGO) run --example sdk_basic -- tests/fixtures/nested "$$OUT/basic" > /dev/null; \
	 test "$$(ls "$$OUT/basic" | wc -l)" -eq 4 || { echo "sdk_basic: expected 4 files"; exit 1; }; \
	 echo "sdk_with_predicate..."; \
	 $(CARGO) run --example sdk_with_predicate -- tests/fixtures/nested "$$OUT/pred" > /dev/null; \
	 echo "cli (depth=0, json)..."; \
	 ./target/release/flattenfs tests/fixtures/nested "$$OUT/cli" --depth 0 --json \
	   | python3 -c 'import sys,json; r=json.load(sys.stdin); assert r["files_processed"]==4, r'; \
	 echo "cli (depth=1, dry-run)..."; \
	 ./target/release/flattenfs tests/fixtures/nested "$$OUT/dr" --depth 1 --dry-run --json \
	   | python3 -c 'import sys,json; r=json.load(sys.stdin); assert r["files_processed"]==4, r'; \
	 rm -rf "$$OUT"; \
	 echo "all examples passed"

.PHONY: ci-full
ci-full: ci examples ## CI + smoke examples (slower)
