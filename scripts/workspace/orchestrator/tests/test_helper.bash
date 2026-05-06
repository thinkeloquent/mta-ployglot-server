# Common bats setup. Sources lib files and points the registry at the fixture lock file.
ORCH_DIR="${BATS_TEST_DIRNAME}/.."
ORCH_FIXTURE_DIR="${BATS_TEST_DIRNAME}/fixtures"

setup_orchestrator() {
  # Each test gets a fresh tmpdir as cwd so any side effects don't leak.
  ORCH_TMPDIR=$(mktemp -d)
  cd "$ORCH_TMPDIR" || return 1
  export ORCH_REGISTRY_LOCK_PATH="${ORCH_FIXTURE_DIR}/workspace.toml.lock.json"
}

teardown_orchestrator() {
  if [[ -n "${ORCH_TMPDIR:-}" && -d "$ORCH_TMPDIR" ]]; then
    rm -rf "$ORCH_TMPDIR"
  fi
}
