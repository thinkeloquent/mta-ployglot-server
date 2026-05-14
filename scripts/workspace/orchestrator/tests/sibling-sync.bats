#!/usr/bin/env bats
# Tests for sibling-sync.sh refusal modes. Each test sets up a tiny git repo
# with a bare-clone "origin", then exercises sibling-sync.sh in different
# scenarios.

load 'test_helper.bash'

setup() {
  setup_orchestrator
  TEST_REMOTE=$(mktemp -d)
  TEST_LOCAL=$(mktemp -d)

  # Bare origin
  git init --bare --quiet "$TEST_REMOTE"

  # Local clone with one initial commit on main
  git -c init.defaultBranch=main clone --quiet "$TEST_REMOTE" "$TEST_LOCAL"
  cd "$TEST_LOCAL"
  git checkout -q -b main 2>/dev/null || git checkout -q main
  git config user.email "test@test"
  git config user.name "Test"
  echo "init" > README.md
  git add README.md
  git commit -q -m "init"
  git push -q origin main

  export SIBLING_NAME=test-sibling
  export SIBLING_DEFAULT_REF=main
}

teardown() {
  cd /
  rm -rf "$TEST_REMOTE" "$TEST_LOCAL"
  teardown_orchestrator
}

@test "dry-run on clean and on-default with no incoming: NOOP 0 commits" {
  cd "$TEST_LOCAL"
  run "$ORCH_DIR/sibling-sync.sh"
  [ "$status" -eq 0 ]
  echo "$output" | grep -qE 'NOOP: 0 commits'
}

@test "apply on clean and on-default with incoming: pulled N commits" {
  # Add a commit upstream via a second clone, then pull
  ANOTHER=$(mktemp -d)
  git clone --quiet "$TEST_REMOTE" "$ANOTHER"
  ( cd "$ANOTHER" && git config user.email t@t && git config user.name t && \
    echo more > extra.txt && git add extra.txt && git commit -q -m extra && git push -q origin main )
  rm -rf "$ANOTHER"

  cd "$TEST_LOCAL"
  run "$ORCH_DIR/sibling-sync.sh" --apply
  [ "$status" -eq 0 ]
  echo "$output" | grep -qE 'PULLED: 1 commits'
}

@test "dirty tree causes SKIP: dirty-tree" {
  cd "$TEST_LOCAL"
  echo "uncommitted" > dirty.txt
  run "$ORCH_DIR/sibling-sync.sh" --apply
  [ "$status" -eq 0 ]
  echo "$output" | grep -q 'SKIP: dirty-tree'
}

@test "non-default branch causes SKIP: on-non-default-branch" {
  cd "$TEST_LOCAL"
  git checkout -q -b feature/x
  run "$ORCH_DIR/sibling-sync.sh" --apply
  [ "$status" -eq 0 ]
  echo "$output" | grep -q 'on-non-default-branch'
}

@test "non-fast-forward causes SKIP: not-fast-forward" {
  cd "$TEST_LOCAL"
  # Diverge: local has a commit that origin doesn't, AND origin has one local doesn't
  ANOTHER=$(mktemp -d)
  git clone --quiet "$TEST_REMOTE" "$ANOTHER"
  ( cd "$ANOTHER" && git config user.email t@t && git config user.name t && \
    echo origin > origin.txt && git add origin.txt && git commit -q -m origin-only && \
    git push -q origin main )
  rm -rf "$ANOTHER"

  echo "local-only" > local.txt
  git add local.txt
  git commit -q -m "local-only-commit"

  run "$ORCH_DIR/sibling-sync.sh" --apply
  [ "$status" -eq 0 ]
  echo "$output" | grep -q 'not-fast-forward'
}

@test "json output has expected keys" {
  cd "$TEST_LOCAL"
  run "$ORCH_DIR/sibling-sync.sh" --json
  [ "$status" -eq 0 ]
  echo "$output" | jq -e '.name and .action and (.commits | type=="number")' >/dev/null
}
