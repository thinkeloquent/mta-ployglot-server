# helpers.bash — shared bats fixtures for bootstrap.sh tests.

# make_fixture: scaffold a temp orchestration shell with two bare-repo "remotes"
# and a workspace.toml pointing at them via file:// URLs.
#
# Echoes the fixture root path on stdout; sets up:
#   $TMP/remotes/{alpha,beta}.git    bare repos with one seed commit each
#   $TMP/_seed/{alpha,beta}          working trees used to push the seed commit
#   $TMP/shell/workspace.toml        registry referencing the two remotes
#
# The bootstrap script clones to $TMP/local/<name> and symlinks at
# $TMP/shell/packages/<name>.
make_fixture() {
  local TMP
  TMP="$(mktemp -d -t bootstrap-test.XXXXXX)"

  mkdir -p "$TMP/remotes" "$TMP/shell" "$TMP/_seed"

  for name in alpha beta; do
    git init --bare --initial-branch=main "$TMP/remotes/$name.git" >/dev/null
    git -c init.defaultBranch=main clone "$TMP/remotes/$name.git" "$TMP/_seed/$name" >/dev/null 2>&1
    (
      cd "$TMP/_seed/$name"
      echo "package $name" > README.md
      git add .
      git -c user.email=t@t -c user.name=t commit -qm "seed"
      # The remote's HEAD is unset until we push; pushing main sets it.
      git push -q origin main
    )
  done

  cat > "$TMP/shell/workspace.toml" <<EOF
[[entry]]
name           = "alpha"
remote         = "file://$TMP/remotes/alpha.git"
local_path     = "$TMP/local/alpha"
shell_path     = "$TMP/shell/packages/alpha"
language       = "node"
subtree_prefix = "packages/alpha"
default_ref    = "main"

[[entry]]
name           = "beta"
remote         = "file://$TMP/remotes/beta.git"
local_path     = "$TMP/local/beta"
shell_path     = "$TMP/shell/packages/beta"
language       = "node"
subtree_prefix = "packages/beta"
default_ref    = "main"
EOF

  echo "$TMP"
}

# Run bootstrap.sh against a fixture's registry. Quiet stderr unless the test
# captures it explicitly via `run`.
run_bootstrap() {
  local fixture="$1"; shift
  WORKSPACE_REGISTRY="$fixture/shell/workspace.toml" \
    "$BATS_TEST_DIRNAME/../bootstrap.sh" "$@"
}
