#!/usr/bin/env bash
# subtree-assemble.sh — inverse of bootstrap.
#
# Walks workspace.toml, replaces every symlink at <subtree_prefix> with a real
# directory of source via `git subtree add --prefix <p> <remote> <ref> --squash`,
# producing a unified release branch that downstream deploy + scan tooling can
# consume without recursive cloning.
#
# Subcommands:
#   assemble REF        on the named branch, run the squashed-subtree merge
#                       loop. Acquires an exclusive lock at .git/.subtree-
#                       assemble.lock.d/ — second concurrent invocation exits
#                       75 (EX_TEMPFAIL) with the holder PID.
#   verify              run doctor + make ci + assert-real-dirs on the
#                       currently checked-out tree. Refuses if branch isn't
#                       release/*.
#   assert-real-dirs    every entry's subtree_prefix must be a real directory
#                       (not a symlink, not missing). Read-only.
#
# Exit codes:
#   0     success
#   1     verification failed
#   64    bad args
#   65    not a release/* branch (verify only)
#   66    workspace.toml missing
#   68    git subtree add or remote add failed (failing entry name printed)
#   75    EX_TEMPFAIL — another assembler holds the lock
#   127   missing dependency
#
# IMPORTANT: every `git subtree (add|pull|merge)` invocation in this file MUST
# include `--squash`. scripts/workspace/subtree-lint.sh greps for the verb
# without the flag and exits non-zero if any match is found. Without --squash,
# the assembled .git/ grows unboundedly.
set -euo pipefail
IFS=$'\n\t'

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${ROOT_DIR:-$(cd "$SELF_DIR/../.." && pwd)}"
REG="${WORKSPACE_REGISTRY:-$ROOT_DIR/workspace.toml}"
LOCK_BASE="$ROOT_DIR/.git/.subtree-assemble.lock"
LOCK_DIR="$LOCK_BASE.d"
LOCK_PID_FILE="$LOCK_BASE"

# ---------- helpers ----------

usage() {
  sed -n '3,/^# Exit codes:/p' "$0" | sed 's/^# \?//'
}

require_tool() {
  local t="$1"
  command -v "$t" >/dev/null 2>&1 || { echo "missing: $t" >&2; exit 127; }
}

require_branch_release() {
  local b
  b="$(git -C "$ROOT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")"
  case "$b" in
    release/*) ;;
    *) echo "FAIL: must be on a release/* branch; got '$b'" >&2; exit 65 ;;
  esac
}

# Atomic lock via `mkdir` (portable; flock is Linux-only). The directory's
# creation is atomic on POSIX. The PID file inside is for diagnostics only.
acquire_lock_or_die() {
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    echo "$$" >"$LOCK_PID_FILE"
    trap 'release_lock' EXIT INT TERM
    echo "[lock] acquired by PID $$"
    return 0
  fi
  local holder="unknown"
  if [[ -f "$LOCK_PID_FILE" ]]; then
    holder="$(cat "$LOCK_PID_FILE" 2>/dev/null || echo unknown)"
  fi
  echo "FAIL: another assembly is in progress (holder PID: $holder)" >&2
  echo "  if no process is actually running, remove the stale lock:" >&2
  echo "    rm -rf $LOCK_DIR $LOCK_PID_FILE" >&2
  exit 75
}

release_lock() {
  rm -rf "$LOCK_DIR" "$LOCK_PID_FILE" 2>/dev/null || true
  echo "[lock] released"
}

read_registry_for_assembly() {
  python3 - "$REG" <<'PY'
import sys, tomllib
with open(sys.argv[1], "rb") as f:
    doc = tomllib.load(f)
for e in doc.get("entry", []):
    print("\t".join([
        e["name"],
        e["remote"],
        e["subtree_prefix"],
        e.get("default_ref", "main"),
    ]))
PY
}

# ---------- subcommands ----------

cmd_assemble() {
  local ref="${1:-}"
  if [[ -z "$ref" ]]; then
    echo "FAIL: REF required (usage: $(basename "$0") assemble <ref>)" >&2
    exit 64
  fi
  if [[ ! -f "$REG" ]]; then
    echo "FAIL: registry not found: $REG" >&2
    exit 66
  fi

  require_tool git
  require_tool python3

  acquire_lock_or_die

  cd "$ROOT_DIR"

  # Ensure we're on the named ref (detached HEAD or branch — either is fine).
  git fetch origin "$ref" 2>/dev/null || true
  git checkout "$ref"

  local snapshot_sha
  snapshot_sha="$(git rev-parse HEAD)"
  echo "[assemble] starting on $ref (HEAD: $snapshot_sha)"

  # Iterate the registry and run one squashed `git subtree add` per entry.
  local rc=0
  while IFS=$'\t' read -r name remote prefix default_ref; do
    [[ -z "$name" ]] && continue
    echo "==> subtree: assemble $name @ $default_ref into $prefix"

    # Remove existing symlink (or empty dir) at the prefix.
    if [[ -L "$prefix" ]]; then
      rm "$prefix"
    elif [[ -d "$prefix" ]] && [[ -z "$(ls -A "$prefix" 2>/dev/null)" ]]; then
      rmdir "$prefix"
    fi

    # Add a temp remote for the sibling. -f fetches it.
    if ! git remote add -f "subtree-$name" "$remote"; then
      echo "FAIL: remote add failed for entry '$name': $remote" >&2
      git reset --hard "$snapshot_sha"
      rc=68
      break
    fi

    # The actual squashed merge. CRITICAL: --squash is non-negotiable.
    if ! git subtree add --prefix "$prefix" "subtree-$name" "$default_ref" --squash \
            -m "subtree: assemble $name @ $default_ref into $prefix"; then
      echo "FAIL: subtree-add failed for entry '$name'" >&2
      git remote remove "subtree-$name" 2>/dev/null || true
      git reset --hard "$snapshot_sha"
      rc=68
      break
    fi

    # Cleanup the temp remote so the orchestration shell's remote list
    # stays small across releases.
    git remote remove "subtree-$name" 2>/dev/null || true
  done < <(read_registry_for_assembly)

  if [[ "$rc" -ne 0 ]]; then
    echo "[assemble] FAILED — branch reset to $snapshot_sha" >&2
    exit "$rc"
  fi

  echo "[assemble] done"
}

cmd_verify() {
  if [[ ! -f "$REG" ]]; then
    echo "FAIL: registry not found: $REG" >&2
    exit 66
  fi
  require_branch_release

  echo "==> doctor"
  bash "$SELF_DIR/doctor.sh"

  echo "==> make ci"
  ( cd "$ROOT_DIR" && make ci )

  echo "==> assert-real-dirs"
  cmd_assert_real_dirs
}

cmd_assert_real_dirs() {
  if [[ ! -f "$REG" ]]; then
    echo "FAIL: registry not found: $REG" >&2
    exit 66
  fi
  python3 - "$REG" "$ROOT_DIR" <<'PY' || exit 1
import os, sys, tomllib
reg, root = sys.argv[1], sys.argv[2]
with open(reg, "rb") as f:
    doc = tomllib.load(f)
fail = False
for e in doc.get("entry", []):
    p = os.path.join(root, e["subtree_prefix"])
    if os.path.islink(p):
        print(f"FAIL: {p} is still a symlink"); fail = True
    elif not os.path.isdir(p):
        print(f"FAIL: {p} is not a directory"); fail = True
if fail:
    sys.exit(1)
print("ok: all subtree prefixes are real directories")
PY
}

# ---------- main ----------

cmd="${1:-}"
shift || true

case "$cmd" in
  assemble)         cmd_assemble "$@" ;;
  verify)           cmd_verify ;;
  assert-real-dirs) cmd_assert_real_dirs ;;
  -h|--help|"")     usage ;;
  *) echo "unknown subcommand: $cmd" >&2; usage >&2; exit 64 ;;
esac
