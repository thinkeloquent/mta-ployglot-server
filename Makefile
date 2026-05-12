# Makefile — mta-ployglot-server orchestration shell.
#
# This is a thin composition layer. All variables live in Makefile.vars; all
# recipes live in fragments named Makefile.<area>. The root file owns:
#   - the include chain (vars first, then fragments)
#   - the top-level aggregators (`ci`, `ci-local`)
#   - `help`, which scans every included fragment and prints a sectioned listing
#
# Adding a new area means dropping a new Makefile.<area> next to this one and
# adding one `include` line below — `make help` picks it up automatically.
#
# Use `-include` for fragments that may not yet exist (so partial refactors
# don't break the build); use `include` for fragments that are required.

include Makefile.vars

# Generated registry projection (Makefile.entries) — picked up by the
# per-language fragments via $(NODE_PKGS), $(PY_PKGS), etc. Optional so a
# fresh clone before bootstrap doesn't fail the include chain.
-include Makefile.entries

include Makefile.compose
include Makefile.devmode

# Raw `docker` (not `docker compose`) lifecycle — per-runtime build / run /
# cleanup / daemon controls; supports VAULT_MOUNT bind-mount + build-arg.
-include Makefile.docker

# Prod-mode runner (host-direct, parallel to devmode). Uses .prod/ staging,
# copies (not symlinks) for siblings, NODE_ENV=production, no --watch.
-include Makefile.prod

# Smoke targets for the app-yaml chain (F01..F06 verification).
-include Makefile.smoke

# Multi-repo orchestration: per-sibling git ops (status-all, sync-all,
# branch-all, commit-all, push-all). Reads .dev/workspace.toml.lock.json.
-include Makefile.orchestrator

# Checklist gate library: vault-check, addon-lint, twin-diff, security-scan,
# changelog-check, agent-md-check, plus pre-push aggregator + checklist walker.
-include Makefile.gates

# Per-language fragments — registry-driven via $(NODE_PKGS) / $(PY_PKGS) /
# $(GO_PKGS) / $(RUST_PKGS). Each fragment is a no-op when its toolchain is
# missing, so it's safe to always include.
-include Makefile.lang.node
-include Makefile.lang.python
-include Makefile.lang.python.uv
-include Makefile.lang.go
-include Makefile.lang.rust

# Future area fragments (lands in their respective stages):
-include Makefile.symlinks
-include Makefile.subtree
-include Makefile.projections
-include Makefile.health
-include Makefile.servers-ci

# Workspace policy enforcement: workspace.sync consolidates the non-subtree
# scripts that release.yml previously inlined (fix-pnpm-wrappers,
# check-no-hardcoded-registry, check-python-pins, release-preflight.sh).
-include Makefile.workspace

# Dependency-state reset: clean-locks / clean-install-cache / clean-deps.
-include Makefile.clean

# Single-repo git ops: git-pull (clean + fetch + hard-reset).
-include Makefile.git

# ---------------------------------------------------------------------------
# aggregators
# ---------------------------------------------------------------------------

.PHONY: ci
ci: projections-check subtree-lint ci-install lint test build ## Full CI pipeline: projections-check → subtree-lint → ci-install → lint → test → build

.PHONY: ci-local
ci-local: doctor ci ## Local CI: run `doctor` first, then full pipeline

# ---------------------------------------------------------------------------
# help — sectioned listing across every included fragment
# ---------------------------------------------------------------------------

.PHONY: help
help: ## Show available targets, grouped by fragment
	@printf "\nUsage: make <target>\n\n"
	@printf "Sections come from Makefile.<area> fragments; per-target dim suffix shows the source.\n"
	@for f in $(MAKEFILE_LIST); do \
	  base="$$(basename "$$f")"; \
	  case "$$base" in Makefile.vars|Makefile.entries|.env) continue ;; esac; \
	  if [ "$$(awk -F':' '/^[a-zA-Z_.-]+:.*##/' $$f | wc -l)" -eq 0 ]; then \
	    printf "\033[33mwarn: %s has no documented targets\033[0m\n" "$$f"; \
	  fi; \
	done
	@awk 'BEGIN { FS=":.*##" } \
	  FNR==1 { src=FILENAME; sub(".*/","",src); sub("^Makefile\\.","",src); \
	           if (src=="Makefile") src="root"; \
	           if (src=="vars" || src=="entries" || src==".env") next; \
	           header_for[src]=sprintf("\n=== %s ===\n", src); printed[src]=0 } \
	  /^[a-zA-Z_.-]+:.*##/ { \
	    if (!printed[src]) { printf "%s", header_for[src]; printed[src]=1 } \
	    printf "  \033[36m%-22s\033[0m %s \033[2m(%s)\033[0m\n", $$1, $$2, src \
	  }' \
	  $(sort $(MAKEFILE_LIST))
