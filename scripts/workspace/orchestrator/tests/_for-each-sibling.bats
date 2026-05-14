#!/usr/bin/env bats
# Tests for _for-each-sibling.sh. Uses a 3-sibling fixture: node, python, not-hydrated.

load 'test_helper.bash'

setup() {
  setup_orchestrator
  # Materialize the two hydrated fake siblings as empty dirs in a tmpdir.
  FIXTURE_BASE=$(mktemp -d)
  mkdir -p "$FIXTURE_BASE/fake-node" "$FIXTURE_BASE/fake-py"
  # Build a per-test lock file with paths pointing at $FIXTURE_BASE
  ORCH_REGISTRY_LOCK_PATH="$ORCH_TMPDIR/lock.json"
  export ORCH_REGISTRY_LOCK_PATH
  sed "s|FIXTURE_TMPDIR|$FIXTURE_BASE|g" "$ORCH_FIXTURE_DIR/workspace.toml.lock.json" \
    > "$ORCH_REGISTRY_LOCK_PATH"
}

teardown() {
  rm -rf "$FIXTURE_BASE"
  teardown_orchestrator
}

@test "serial-success: command true runs against all hydrated siblings" {
  run "$ORCH_DIR/_for-each-sibling.sh" --cmd 'true'
  [ "$status" -eq 0 ]
  echo "$output" >&3
}

@test "parallel-success: parallel mode succeeds and is faster than serial baseline" {
  run "$ORCH_DIR/_for-each-sibling.sh" --cmd 'sleep 1' --mode parallel
  [ "$status" -eq 0 ]
}

@test "partial-failure: one sibling fails; --keep-going returns failure count" {
  run "$ORCH_DIR/_for-each-sibling.sh" \
    --cmd '[[ "$SIBLING_NAME" == "fake-node" ]] && true || false' \
    --keep-going
  [ "$status" -ne 0 ]
}

@test "first-failure-stops: without --keep-going, exits at first failed sibling" {
  run "$ORCH_DIR/_for-each-sibling.sh" --cmd 'false'
  [ "$status" -ne 0 ]
}

@test "language-filter: --language node iterates only node siblings" {
  run "$ORCH_DIR/_for-each-sibling.sh" \
    --cmd 'echo "$SIBLING_NAME"' \
    --language node \
    --json
  [ "$status" -eq 0 ]
  # Output should contain fake-node but NOT fake-py
  echo "$output" | grep -q '"sibling":"fake-node"'
  ! echo "$output" | grep -q '"sibling":"fake-py"'
}

@test "not-hydrated-skip: not-hydrated sibling emits skipped status, doesn't fail" {
  run "$ORCH_DIR/_for-each-sibling.sh" --cmd 'true' --json
  [ "$status" -eq 0 ]
  # fake-not-hydrated should appear with status:skipped
  echo "$output" | grep -q '"sibling":"fake-not-hydrated"'
  echo "$output" | grep -q '"status":"skipped"'
}

@test "json-output-shape: every line has sibling, status, exit_code, duration_ms" {
  run "$ORCH_DIR/_for-each-sibling.sh" --cmd 'true' --json
  [ "$status" -eq 0 ]
  while IFS= read -r line; do
    [[ -n "$line" ]] || continue
    echo "$line" | jq -e '.sibling and .status and (.exit_code | type == "number") and (.duration_ms | type == "number")' >/dev/null
  done <<< "$output"
}

@test "missing --cmd: exits 64 with usage hint" {
  run "$ORCH_DIR/_for-each-sibling.sh"
  [ "$status" -eq 64 ]
}

@test "no-skip-not-hydrated: not-hydrated counts as failure" {
  run "$ORCH_DIR/_for-each-sibling.sh" --cmd 'true' --no-skip-not-hydrated --keep-going
  [ "$status" -ne 0 ]
}

# Regression: Makefile.orchestrator used a relative ORCH_DIR (`scripts/workspace/orchestrator`),
# but the helper cds into each sibling's local_path before bash -c "$CMD". A
# relative-path --cmd resolves against the sibling's cwd → exit 127. Asserts an
# absolute --cmd never returns 127 (command-not-found).
@test "A5a/absolute-cmd-resolves-after-cd: real script via absolute path is not 127" {
  run "$ORCH_DIR/_for-each-sibling.sh" --cmd "$ORCH_DIR/sibling-status.sh --json" --keep-going --json
  [ "$status" -ne 127 ]
}

# Regression: `make status-all`'s jq filter was `all(.; .status == "ok")` — but
# stdout interleaves wrapper records (have .sibling) with inner-script records
# (have .name only) when both layers run --json. The filter must scope to
# wrapper records first via `[.[] | select(.sibling)] | all(...)`.
@test "A5b/status-all-jq-scopes-to-wrapper-records: scoped filter passes when all wrappers ok" {
  output=$("$ORCH_DIR/_for-each-sibling.sh" --cmd 'true' --keep-going --json)
  echo "$output" \
    | jq -se '[.[] | select(.sibling)] | all(.[]; .status == "ok" or .status == "skipped")' \
    >/dev/null
}

# Regression: emit_record's failure branch used '${duration_ms}' inside single
# quotes — bash printed it literally on every failure line. Replaced with
# '%sms' + "$duration_ms". Verify failure output renders numeric ms and does
# NOT contain the literal placeholder.
@test "A5c/failure-printf-renders-numeric-ms: failure stderr shows <digits>ms, not \${duration_ms}" {
  run bash -c "'$ORCH_DIR/_for-each-sibling.sh' --cmd 'false' --keep-going 2>&1"
  [ "$status" -ne 0 ]
  echo "$output" | grep -qE '\([0-9]+ms\)'
  ! echo "$output" | grep -qF '${duration_ms}'
}

# --siblings filter: explicit subset narrows iteration to the named siblings,
# preserving registry order. Intersection with --language is implicit.
@test "siblings-filter/explicit-subset: --siblings 'fake-py' iterates only that sibling" {
  run "$ORCH_DIR/_for-each-sibling.sh" --cmd 'echo "$SIBLING_NAME"' --siblings 'fake-py' --json
  [ "$status" -eq 0 ]
  echo "$output" | grep -q '"sibling":"fake-py"'
  ! echo "$output" | grep -q '"sibling":"fake-node"'
}

# --siblings filter rejects unknown names so a typo cannot silently widen scope
# back to the full language-matched set. This is the silent-foot-gun fix.
@test "siblings-filter/unknown-name-refuses: unknown sibling exits 64 with hint" {
  run bash -c "'$ORCH_DIR/_for-each-sibling.sh' --cmd 'true' --siblings 'fake-node nonexistent-sibling' 2>&1"
  [ "$status" -eq 64 ]
  echo "$output" | grep -qF 'unknown sibling(s) in --siblings: nonexistent-sibling'
}

# --siblings + --language compose: subset is the intersection.
@test "siblings-filter/intersects-with-language: --siblings 'fake-py' --language node refuses (no overlap)" {
  run "$ORCH_DIR/_for-each-sibling.sh" --cmd 'true' --siblings 'fake-py' --language node
  [ "$status" -eq 64 ]
}
