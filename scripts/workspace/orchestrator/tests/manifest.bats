#!/usr/bin/env bats
# Contract tests for lib/manifest.sh + lib/manifest-emit.sh (F03 S01).
# Run from scripts/workspace/orchestrator/ via `bats tests/`.

load 'test_helper.bash'

setup() {
  setup_orchestrator
  # The validator script resolves the schema relative to a path; symlink the
  # real schema into the tmpdir so MANIFEST_SCHEMA_PATH resolves.
  mkdir -p scripts/workspace
  cp "${BATS_TEST_DIRNAME}/../../release-manifest.schema.json" \
     scripts/workspace/release-manifest.schema.json
}

teardown() {
  teardown_orchestrator
}

@test "emitter writes deterministic, sorted, validate-clean TOML" {
  source "${ORCH_DIR}/lib/manifest-emit.sh"
  printf 'b 0123456789abcdef0123456789abcdef01234567 main ../b\na fedcba9876543210fedcba9876543210fedcba98 main ../a\n' \
    | MANIFEST_CUT_AT=2026-01-02T03:04:05Z MANIFEST_CUT_BY="t <t@t>" \
      manifest::emit out.toml release/foo

  # Sorted: 'a' before 'b'.
  run grep -o 'name = "[^"]*"' out.toml
  [ "$status" -eq 0 ]
  [ "${lines[0]}" = 'name = "a"' ]
  [ "${lines[1]}" = 'name = "b"' ]
}

@test "emitter is byte-identical across runs given fixed timestamp" {
  source "${ORCH_DIR}/lib/manifest-emit.sh"
  for i in 1 2; do
    printf 'a 0123456789abcdef0123456789abcdef01234567 main ../a\n' \
      | MANIFEST_CUT_AT=2026-01-02T03:04:05Z MANIFEST_CUT_BY="t <t@t>" \
        manifest::emit "out${i}.toml" release/foo
  done
  diff -q out1.toml out2.toml
}

@test "reader returns release_ref / sibling_names / sibling_sha" {
  source "${ORCH_DIR}/lib/manifest-emit.sh"
  printf 'one 0123456789abcdef0123456789abcdef01234567 main ../one\n' \
    | MANIFEST_CUT_AT=fixed MANIFEST_CUT_BY="t <t@t>" \
      manifest::emit out.toml release/x

  run bash -c "source ${ORCH_DIR}/lib/manifest.sh; manifest::release_ref out.toml"
  [ "$status" -eq 0 ] && [ "$output" = "release/x" ]

  run bash -c "source ${ORCH_DIR}/lib/manifest.sh; manifest::sibling_names out.toml"
  [ "$status" -eq 0 ] && [ "$output" = "one" ]

  run bash -c "source ${ORCH_DIR}/lib/manifest.sh; manifest::sibling_sha out.toml one"
  [ "$status" -eq 0 ] && [ "$output" = "0123456789abcdef0123456789abcdef01234567" ]
}

@test "validator accepts a freshly-emitted manifest" {
  source "${ORCH_DIR}/lib/manifest-emit.sh"
  printf 'a 0123456789abcdef0123456789abcdef01234567 main ../a\n' \
    | MANIFEST_CUT_AT=fixed MANIFEST_CUT_BY="t <t@t>" \
      manifest::emit out.toml release/x
  run bash -c "source ${ORCH_DIR}/lib/manifest.sh; manifest::validate out.toml"
  [ "$status" -eq 0 ]
}

@test "validator rejects short SHA" {
  cat > bad.toml <<'EOF'
release_ref = "release/x"
cut_at = "2026-01-02T03:04:05Z"
cut_by = "t <t@t>"

[[sibling]]
name = "a"
pinned_sha = "deadbeef"
pinned_from_ref = "main"
local_path = "../a"
EOF
  run bash -c "source ${ORCH_DIR}/lib/manifest.sh; manifest::validate bad.toml"
  [ "$status" -eq 1 ]
  [[ "$output" =~ "40-char lowercase hex SHA" ]]
}

@test "validator rejects duplicate sibling names" {
  cat > dup.toml <<'EOF'
release_ref = "release/x"
cut_at = "2026-01-02T03:04:05Z"
cut_by = "t <t@t>"

[[sibling]]
name = "a"
pinned_sha = "0123456789abcdef0123456789abcdef01234567"
pinned_from_ref = "main"
local_path = "../a"

[[sibling]]
name = "a"
pinned_sha = "fedcba9876543210fedcba9876543210fedcba98"
pinned_from_ref = "main"
local_path = "../a2"
EOF
  run bash -c "source ${ORCH_DIR}/lib/manifest.sh; manifest::validate dup.toml"
  [ "$status" -eq 1 ]
  [[ "$output" =~ "duplicate sibling name" ]]
}

@test "validator rejects manifest with non-release ref" {
  cat > bad.toml <<'EOF'
release_ref = "main"
cut_at = "2026-01-02T03:04:05Z"
cut_by = "t <t@t>"

[[sibling]]
name = "a"
pinned_sha = "0123456789abcdef0123456789abcdef01234567"
pinned_from_ref = "main"
local_path = "../a"
EOF
  run bash -c "source ${ORCH_DIR}/lib/manifest.sh; manifest::validate bad.toml"
  [ "$status" -eq 1 ]
  [[ "$output" =~ "release_ref" ]]
}

@test "JSON-line projection is one line per sibling" {
  source "${ORCH_DIR}/lib/manifest-emit.sh"
  printf 'a 0123456789abcdef0123456789abcdef01234567 main ../a\nb fedcba9876543210fedcba9876543210fedcba98 main ../b\n' \
    | MANIFEST_CUT_AT=fixed MANIFEST_CUT_BY="t <t@t>" \
      manifest::emit out.toml release/x
  manifest::emit_jsonl out.toml out.jsonl
  run wc -l < out.jsonl
  [ "$status" -eq 0 ]
  # macOS wc emits leading whitespace; trim.
  [ "$(echo "$output" | tr -d ' ')" = "2" ]
}
