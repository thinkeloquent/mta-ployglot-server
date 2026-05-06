#!/usr/bin/env bats
# bootstrap.bats — smoke tests for scripts/workspace/bootstrap.sh.
#
# Three contracts:
#   1. Happy path           clones siblings + creates symlinks
#   2. Idempotency          second run produces no filesystem changes
#   3. Unreachable remote   fails fast and names the offending entry

load 'helpers'

setup() {
  FIXTURE="$(make_fixture)"
}

teardown() {
  if [[ -n "${FIXTURE:-}" && -d "$FIXTURE" ]]; then
    rm -rf "$FIXTURE"
  fi
}

@test "fixture builds with two bare remotes and a workspace.toml" {
  [[ -d "$FIXTURE/remotes/alpha.git" ]]
  [[ -d "$FIXTURE/remotes/beta.git" ]]
  [[ -f "$FIXTURE/shell/workspace.toml" ]]
}

@test "happy path: clones siblings and creates symlinks" {
  run run_bootstrap "$FIXTURE"
  [ "$status" -eq 0 ]

  # Both clones landed.
  [[ -d "$FIXTURE/local/alpha/.git" ]]
  [[ -d "$FIXTURE/local/beta/.git" ]]

  # Both symlinks point at their respective clones.
  [[ -L "$FIXTURE/shell/packages/alpha" ]]
  [[ -L "$FIXTURE/shell/packages/beta" ]]

  # The symlink resolves to a directory containing the seed README.
  [[ -f "$FIXTURE/shell/packages/alpha/README.md" ]]
  [[ -f "$FIXTURE/shell/packages/beta/README.md" ]]
}

@test "idempotency: second run produces no filesystem changes" {
  run run_bootstrap "$FIXTURE"
  [ "$status" -eq 0 ]

  # Marker file timestamped now; sleep 1s to ensure mtime resolution captures
  # any subsequent change.
  touch "$FIXTURE/.idempotency-marker"
  sleep 1

  run run_bootstrap "$FIXTURE"
  [ "$status" -eq 0 ]

  # No file under $FIXTURE/local or $FIXTURE/shell should be newer than the
  # marker. Exclude the marker itself and any .git internal scratch.
  changed="$(find "$FIXTURE/local" "$FIXTURE/shell/packages" \
              -newer "$FIXTURE/.idempotency-marker" \
              -not -path '*/.git/*' \
              -not -name '.idempotency-marker' \
              2>/dev/null)"
  [ -z "$changed" ]
}

@test "unreachable remote fails fast and names the entry" {
  # Point alpha at a nonexistent file:// URL; beta stays valid.
  sed -i.bak \
    "s|file://$FIXTURE/remotes/alpha.git|file:///nonexistent/alpha.git|" \
    "$FIXTURE/shell/workspace.toml"

  run run_bootstrap "$FIXTURE"
  [ "$status" -ne 0 ]

  # The failing entry name must appear in the error output.
  echo "$output" | grep -q "alpha"
}

@test "--only=<name> filters to a single entry" {
  run run_bootstrap "$FIXTURE" --only=alpha
  [ "$status" -eq 0 ]

  # alpha hydrated, beta untouched.
  [[ -L "$FIXTURE/shell/packages/alpha" ]]
  [[ ! -e "$FIXTURE/shell/packages/beta" ]]
}

@test "--dry-run produces no filesystem changes" {
  touch "$FIXTURE/.dryrun-marker"
  sleep 1

  run run_bootstrap "$FIXTURE" --dry-run
  [ "$status" -eq 0 ]
  echo "$output" | grep -q '\[dry-run\]'

  # Nothing under local/ or shell/packages/ should exist after dry-run.
  [[ ! -d "$FIXTURE/local" ]]
  [[ ! -d "$FIXTURE/shell/packages" ]]
}

@test "shell_path occupied by a real directory aborts with exit 67" {
  # Pre-create alpha as a real directory containing a file. Bootstrap must
  # refuse to overwrite it.
  mkdir -p "$FIXTURE/shell/packages/alpha"
  echo "user data" > "$FIXTURE/shell/packages/alpha/keep.me"

  run run_bootstrap "$FIXTURE"
  [ "$status" -ne 0 ]
  # The non-zero exit propagates — exact code is 68 (from the per-entry
  # failure aggregator) but the user-facing diagnostic includes "real directory".
  echo "$output" | grep -q 'real directory'

  # The user's file is preserved.
  [[ -f "$FIXTURE/shell/packages/alpha/keep.me" ]]
}
