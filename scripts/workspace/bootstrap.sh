#!/usr/bin/env bash
# bootstrap.sh — hydrate the polyglot workspace from workspace.toml.
#
# System-of-record for clone + symlink + emitter chain. The .claude skill
# (local-workspace-bootstrap) is a thin wrapper around this script; CI and
# manual shell users call it directly.
#
# Modes:
#   (default)         hydrate    : clone missing, ensure symlinks, run all emitters
#   --dry-run         dry-run    : print the plan, touch nothing
#   --re-emit-only    re-emit    : skip clone+symlink, just run emitters
#   --verify          verify     : assert workspace matches registry; non-zero on drift
#
# Filters:
#   --only=<name>    operate on a single registry entry by name
#
# Vault override (vault-wins per the vault-file-priority memory):
#   For each entry, if WORKSPACE_OVERRIDE_<NAME_UPPER> is set in the env, that
#   value wins over the entry's local_path. NAME_UPPER converts kebab-case to
#   SNAKE_CASE_UPPER (e.g. print-routes → PRINT_ROUTES).
#
# Exits:
#   0   success
#   64  unknown flag (EX_USAGE)
#   65  registry validation failed
#   66  registry not found
#   67  shell_path occupied by a real (non-symlink) directory — refuses to overwrite
#   68  unreachable remote (entry name in error message)
#   70  emitter failure (entry into emit_manifests fails)
#   127 missing dependency (python3, git, validate.sh)
set -euo pipefail
IFS=$'\n\t'

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SELF_DIR/../.." && pwd)"
REGISTRY="${WORKSPACE_REGISTRY:-$ROOT_DIR/workspace.toml}"

MODE="hydrate"
ONLY=""

usage() {
  cat <<'USAGE'
bootstrap.sh — hydrate the polyglot workspace from workspace.toml

USAGE:
  bootstrap.sh [--dry-run | --re-emit-only | --verify] [--only=<name>] [-h|--help]

MODES:
  (default)         clone missing siblings, ensure symlinks, run all emitters
  --dry-run         print the plan; do not touch the filesystem
  --re-emit-only    skip clone+symlink; just regenerate per-language manifests
  --verify          assert workspace matches registry; non-zero on drift

FILTER:
  --only=<name>     act on a single registry entry by name (e.g. --only=print-routes)

ENV:
  WORKSPACE_REGISTRY                 path to workspace.toml (default: <root>/workspace.toml)
  WORKSPACE_OVERRIDE_<NAME_UPPER>    override an entry's local_path (vault-wins)
USAGE
}

log() {
  printf '[bootstrap %s] %s\n' "$(date +%H:%M:%S)" "$*"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)        MODE="dry-run";        shift ;;
    --re-emit-only)   MODE="re-emit";        shift ;;
    --verify)         MODE="verify";         shift ;;
    --only=*)         ONLY="${1#*=}";        shift ;;
    -h|--help)        usage; exit 0 ;;
    *) printf 'unknown flag: %s\n' "$1" >&2; usage >&2; exit 64 ;;
  esac
done

# --- preflight ----------------------------------------------------------------

for tool in python3 git; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "missing: $tool" >&2
    exit 127
  fi
done

if [[ ! -f "$REGISTRY" ]]; then
  echo "FAIL: registry not found: $REGISTRY" >&2
  exit 66
fi

# Validate the registry up front. Skip if validate.sh is missing (graceful
# degradation for older clones that haven't pulled Stage 1) but log loudly.
if [[ -x "$SELF_DIR/validate.sh" ]]; then
  if ! "$SELF_DIR/validate.sh" "$REGISTRY" >/dev/null; then
    echo "FAIL: $REGISTRY did not validate" >&2
    exit 65
  fi
else
  log "warn: $SELF_DIR/validate.sh missing — skipping schema check"
fi

# --- helpers ------------------------------------------------------------------

# kebab-case → SNAKE_CASE_UPPER for vault env var names.
to_env_name() {
  printf '%s' "$1" | tr '[:lower:]-' '[:upper:]_'
}

# Compute a path RELATIVE to a directory using only POSIX tools. macOS realpath
# does not support `--relative-to`. Both args must be absolute.
relpath() {
  python3 - "$1" "$2" <<'PY'
import os, sys
target, start = sys.argv[1], sys.argv[2]
print(os.path.relpath(target, start))
PY
}

# Resolve a registry entry's effective local_path: vault override wins.
effective_local_path() {
  local name="$1" raw="$2"
  local var
  var="WORKSPACE_OVERRIDE_$(to_env_name "$name")"
  if [[ -n "${!var:-}" ]]; then
    printf '%s' "${!var}"
    return
  fi
  # Resolve relative to ROOT_DIR if not absolute.
  if [[ "$raw" != /* ]]; then
    printf '%s' "$ROOT_DIR/$raw"
  else
    printf '%s' "$raw"
  fi
}

# Resolve a registry entry's effective shell_path (always relative to ROOT_DIR).
effective_shell_path() {
  local raw="$1"
  if [[ "$raw" != /* ]]; then
    printf '%s' "$ROOT_DIR/$raw"
  else
    printf '%s' "$raw"
  fi
}

# Read the registry into a tab-separated stream of fields.
read_registry() {
  python3 - "$REGISTRY" <<'PY'
import sys, tomllib
with open(sys.argv[1], "rb") as f:
    doc = tomllib.load(f)
for e in doc.get("entry", []):
    fields = [
        e["name"], e["remote"], e["local_path"], e["shell_path"],
        e["language"], e["subtree_prefix"], e.get("default_ref", "main"),
    ]
    print("\t".join(fields))
PY
}

# Check that a remote is reachable. Uses `git ls-remote` which is cheap and
# does not require a clone. file:// URLs are reachable iff the path exists.
remote_reachable() {
  local remote="$1" name="$2"
  if git ls-remote --heads "$remote" >/dev/null 2>&1; then
    return 0
  fi
  echo "FAIL: remote unreachable for entry '$name': $remote" >&2
  return 1
}

# --- per-entry processing -----------------------------------------------------

process_entry() {
  local name="$1" remote="$2" local_path_raw="$3" shell_path_raw="$4" \
        _language="$5" _subtree="$6" default_ref="$7"

  if [[ -n "$ONLY" && "$name" != "$ONLY" ]]; then
    return 0
  fi

  local local_path shell_path
  local_path="$(effective_local_path "$name" "$local_path_raw")"
  shell_path="$(effective_shell_path "$shell_path_raw")"

  case "$MODE" in
    verify)
      # Read-only assertions: clone exists, symlink exists and resolves to local_path.
      if [[ ! -d "$local_path" ]]; then
        echo "FAIL: missing clone for entry '$name': $local_path" >&2
        return 1
      fi
      if [[ ! -L "$shell_path" ]]; then
        echo "FAIL: missing symlink for entry '$name': $shell_path" >&2
        return 1
      fi
      local resolved
      resolved="$(cd "$(dirname "$shell_path")" && cd "$(readlink "$shell_path")" && pwd)" \
        || { echo "FAIL: dangling symlink for entry '$name': $shell_path" >&2; return 1; }
      local expected
      expected="$(cd "$local_path" && pwd)"
      if [[ "$resolved" != "$expected" ]]; then
        echo "FAIL: symlink for '$name' resolves to $resolved, expected $expected" >&2
        return 1
      fi
      log "ok: $name"
      return 0
      ;;
    dry-run)
      if [[ -e "$shell_path" && ! -L "$shell_path" && -d "$shell_path" ]]; then
        log "[dry-run] $shell_path is a real directory (subtree topology); hydrate would refuse"
        return 0
      fi
      if [[ ! -d "$local_path" ]]; then
        log "[dry-run] would clone $remote → $local_path (ref: $default_ref)"
      else
        log "[dry-run] $local_path already cloned"
      fi
      if [[ ! -L "$shell_path" ]]; then
        log "[dry-run] would symlink $shell_path → $local_path"
      else
        log "[dry-run] $shell_path symlink already present"
      fi
      return 0
      ;;
    re-emit)
      # Skip the clone+symlink work entirely — this mode just regenerates
      # manifests. process_entry is still iterated so --only filtering works.
      return 0
      ;;
    hydrate)
      # Refuse to overwrite a real directory at shell_path (e.g. a squashed
      # subtree from a release-branch assembly). hydrate is the only mode
      # that would write to shell_path, so the guard belongs here.
      if [[ -e "$shell_path" && ! -L "$shell_path" && -d "$shell_path" ]]; then
        echo "FAIL: $shell_path exists as a real directory; refusing to overwrite (entry '$name')" >&2
        return 67
      fi
      # Clone if missing.
      if [[ ! -d "$local_path" ]]; then
        if ! remote_reachable "$remote" "$name"; then
          return 68
        fi
        log "clone: $remote → $local_path (ref: $default_ref)"
        mkdir -p "$(dirname "$local_path")"
        git clone --branch "$default_ref" "$remote" "$local_path" \
          || { echo "FAIL: clone failed for entry '$name'" >&2; return 68; }
      else
        log "skip clone: $local_path (already present)"
      fi
      # Ensure symlink at shell_path → local_path (relative for portability).
      if [[ -L "$shell_path" ]]; then
        log "skip link: $shell_path (already a symlink)"
      else
        mkdir -p "$(dirname "$shell_path")"
        local rel
        rel="$(relpath "$local_path" "$(dirname "$shell_path")")"
        ln -s "$rel" "$shell_path"
        log "link: $shell_path → $rel"
      fi
      ;;
  esac
}

# --- emitter chain ------------------------------------------------------------

# Run each emitter, telling it to write next to the registry rather than next
# to itself. This makes bootstrap.sh portable across orchestration shells and
# fixture directories — emitters always write to <REGISTRY_DIR>/<filename>.
emit_manifests() {
  local reg_dir
  reg_dir="$(cd "$(dirname "$REGISTRY")" && pwd)"

  # Each step is "<emitter-basename>|<KEY=VAL>" — KEY=VAL pins the output
  # path next to the registry. Empty KEY=VAL means the emitter handles its
  # own defaulting (e.g. emit-uv-editable.sh).
  local steps=(
    "emit-pnpm.sh|WORKSPACE_PNPM_OUT=$reg_dir/pnpm-workspace.yaml"
    "emit-go-work.sh|WORKSPACE_GO_WORK_OUT=$reg_dir/go.work"
    "emit-cargo.sh|WORKSPACE_CARGO_OUT=$reg_dir/Cargo.toml"
    "emit-make-vars.sh|WORKSPACE_MAKE_VARS_OUT=$reg_dir/Makefile.entries"
    "emit-uv-editable.sh|"
    # Local JSON projection of workspace.toml — read by JS/agents that
    # don't carry a TOML parser. Lives in .dev/ (gitignored), regenerated
    # by `make init` / `make bootstrap`.
    "workspace-lock-emit.sh|WORKSPACE_LOCK_OUT=$reg_dir/.dev/workspace.toml.lock.json"
    # Registry-driven docker-compose.yml — every sibling shows up as a named
    # build.additional_contexts entry so adding to workspace.toml is enough.
    "docker-compose-emit.sh|WORKSPACE_COMPOSE_OUT=$reg_dir/docker-compose.yml"
  )

  local step name env_kv emitter
  for step in "${steps[@]}"; do
    name="${step%%|*}"
    env_kv="${step#*|}"
    emitter="$SELF_DIR/$name"

    if [[ ! -x "$emitter" ]]; then
      log "skip: $name (not present)"
      continue
    fi
    if [[ "$MODE" == "dry-run" ]]; then
      log "[dry-run] would invoke $name"
      continue
    fi

    log "emit: $name"
    if [[ -n "$env_kv" ]]; then
      env "$env_kv" "$emitter" || { echo "FAIL: $name exited non-zero" >&2; exit 70; }
    else
      "$emitter" || { echo "FAIL: $name exited non-zero" >&2; exit 70; }
    fi
  done
}

# --- main ---------------------------------------------------------------------

log "mode: $MODE${ONLY:+ (only=$ONLY)}"
log "registry: $REGISTRY"

failed=0
while IFS=$'\t' read -r name remote local_path_raw shell_path_raw language subtree default_ref; do
  if ! process_entry "$name" "$remote" "$local_path_raw" "$shell_path_raw" \
                     "$language" "$subtree" "$default_ref"; then
    failed=1
  fi
done < <(read_registry)

if [[ "$failed" -ne 0 ]]; then
  echo "FAIL: one or more entries did not satisfy the chosen mode" >&2
  exit 68
fi

# Emitter chain runs in hydrate + re-emit; verify is read-only; dry-run logs.
case "$MODE" in
  hydrate|re-emit|dry-run) emit_manifests ;;
  verify) log "verify ok" ;;
esac

log "done"
