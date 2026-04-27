# Makefile.lang.go — Go workspace mode wrapper.
#
# Unlike Node/Python, Go workspace mode operates on the entire workspace at
# once via a single tool invocation (`go test ./...`), so this fragment does
# not iterate `$(GO_PKGS)`. The list is still useful for the no-replace lint.
#
# `go.no-replace` runs scripts/workspace/lint-no-go-replace.sh which refuses
# any sibling go.mod containing a replace directive — workspace mode
# supersedes per-module replaces, and that's the failure mode the registry
# pattern is designed to prevent.

GO ?= $(shell command -v go 2>/dev/null)

.PHONY: go.install go.ci-install go.lint go.test go.build go.clean go.ci go.no-replace

go.no-replace: ## (go) lint: forbid replace directives in any sibling's go.mod
	@bash $(ROOT_DIR)/scripts/workspace/lint-no-go-replace.sh

go.install: ## (go) sync workspace
	@if [ -z "$(GO)" ]; then echo "skip: no go on PATH"; exit 0; fi; \
	if [ ! -f "$(ROOT_DIR)/go.work" ]; then echo "skip: no go.work (run emit-go-work.sh first)"; exit 0; fi; \
	cd $(ROOT_DIR) && $(GO) work sync

go.ci-install: go.install ## (go) deterministic install (work sync is already deterministic)

go.lint: go.no-replace ## (go) vet + replace-directive lint
	@if [ -z "$(GO)" ]; then echo "skip: no go on PATH"; exit 0; fi; \
	cd $(ROOT_DIR) && $(GO) vet ./...

go.test: ## (go) test the entire workspace
	@if [ -z "$(GO)" ]; then echo "skip: no go on PATH"; exit 0; fi; \
	cd $(ROOT_DIR) && $(GO) test ./...

go.build: ## (go) build all modules
	@if [ -z "$(GO)" ]; then echo "skip: no go on PATH"; exit 0; fi; \
	cd $(ROOT_DIR) && $(GO) build ./...

go.clean: ## (go) clean caches
	@if [ -z "$(GO)" ]; then echo "skip: no go on PATH"; exit 0; fi; \
	$(GO) clean -cache -testcache

go.ci: go.ci-install go.lint go.test go.build ## (go) full pipeline
