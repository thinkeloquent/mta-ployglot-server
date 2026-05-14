#!/usr/bin/env bash
# generate-package-validate.sh — emit per-runtime sibling-install validators
# under .bin/docker/.
#
# Produces two self-contained shell scripts:
#
#   .bin/docker/validate-python.sh
#       Names sourced from .bin/docker/pyproject.docker.toml's
#       [tool.poetry.dependencies] path-deps (i.e. every editable sibling
#       installed by Dockerfile.fastapi). Validates each via `pip show`
#       and reports per-name MISSING if any sibling fell out of the venv.
#
#   .bin/docker/validate-node.sh
#       Names sourced from .bin/docker/pnpm-workspace.yaml's member list:
#       each member's package.json `name` field is collected at generation
#       time. Validates each via `node -e "require.resolve(<name>)"`.
#
# Both validators are COPY'd into the image and run as a `RUN bash …`
# step (see Dockerfile.fastapi for the canonical wiring). They replace
# count-based checks like `pip list --editable | wc -l` which can't
# tell which specific sibling went missing.
#
# Companion to scripts/workspace/generate-docker-path.sh (PATH/PYTHONPATH/
# NODEJSPATH inventory). That generator walks the full ployglots/ tree;
# this one is narrower — it only checks names the Dockerfile actually
# installs, so the validator can't have false positives.
#
# Flags:
#   (no args)   regenerate both .bin/docker/validate-*.sh files
#   --check     compare emitted files to a fresh regen; exit 1 on drift
#
# Exits:
#   0     wrote (or --check passed)
#   1     --check found drift
#   64    bad args
#   66    .bin/docker/pyproject.docker.toml or pnpm-workspace.yaml missing
#   127   python3 missing
set -euo pipefail
IFS=$'\n\t'

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${ROOT_DIR:-$(cd "$SELF_DIR/../.." && pwd)}"
PYPROJECT="${PYPROJECT:-$ROOT_DIR/.bin/docker/pyproject.docker.toml}"
PNPM_WS="${PNPM_WS:-$ROOT_DIR/.bin/docker/pnpm-workspace.yaml}"
OUT_PY="${OUT_PY:-$ROOT_DIR/.bin/docker/validate-python.sh}"
OUT_NODE="${OUT_NODE:-$ROOT_DIR/.bin/docker/validate-node.sh}"

CHECK_MODE=0
for arg in "$@"; do
  case "$arg" in
    --check) CHECK_MODE=1 ;;
    -h|--help)
      sed -n '2,/^set -e/p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//; /^set -e/d'
      exit 0
      ;;
    *) echo "unknown arg: $arg" >&2; exit 64 ;;
  esac
done

if ! command -v python3 >/dev/null 2>&1; then
  echo "missing: python3 (3.11+ for tomllib)" >&2
  exit 127
fi
for f in "$PYPROJECT" "$PNPM_WS"; do
  if [[ ! -f "$f" ]]; then
    echo "missing: $f" >&2
    exit 66
  fi
done

TMP_PY="$(mktemp -t validate-python.sh.XXXXXX)"
TMP_NODE="$(mktemp -t validate-node.sh.XXXXXX)"
trap 'rm -f "$TMP_PY" "$TMP_NODE"' EXIT

python3 - "$PYPROJECT" "$PNPM_WS" "$ROOT_DIR" "$TMP_PY" "$TMP_NODE" <<'PY'
import json
import sys
import tomllib
from pathlib import Path

pyproject_path, pnpm_ws_path, root_dir, out_py, out_node = sys.argv[1:6]
root = Path(root_dir)

# --- Python names: every key in [tool.poetry.dependencies] that has a
#     `path = ...` table (editable path-dep). Skips registry deps like
#     `uvicorn = { extras = [...], version = "==..." }` and the `python`
#     interpreter pin.
with open(pyproject_path, "rb") as f:
    doc = tomllib.load(f)
deps = doc.get("tool", {}).get("poetry", {}).get("dependencies", {})
py_names: list[str] = []
for name, spec in deps.items():
    if name == "python":
        continue
    if isinstance(spec, dict) and "path" in spec:
        py_names.append(name)

# --- Node names: read each pnpm workspace member's package.json `name`.
#     Skip the umbrella (server/fastify) — the validator runs *inside* it,
#     so requiring the umbrella to resolve itself isn't a meaningful check.
import re
node_names: list[str] = []
ws_text = Path(pnpm_ws_path).read_text()
member_paths: list[str] = []
in_packages = False
for line in ws_text.splitlines():
    s = line.rstrip()
    if not s or s.lstrip().startswith("#"):
        continue
    if s.startswith("packages:"):
        in_packages = True
        continue
    if in_packages:
        m = re.match(r"^\s*-\s+(.+?)\s*$", s)
        if m:
            member_paths.append(m.group(1).strip().strip('"').strip("'"))
        elif not s.startswith(" ") and not s.startswith("\t"):
            # left the `packages:` block (new top-level key)
            in_packages = False
for mp in member_paths:
    # Only treat ployglots/ members as siblings; server/<runtime> is the
    # umbrella host whose name (`mta-fastify-server`) isn't a sibling to
    # validate — it's the workspace root the validator runs inside.
    if not mp.startswith("ployglots/"):
        continue
    pkg_json = root / mp / "package.json"
    if not pkg_json.exists():
        # subtree assembly should have materialized every member; refuse to
        # emit a half-baked validator.
        sys.stderr.write(f"FAIL: missing {pkg_json} (pnpm-workspace member without package.json)\n")
        sys.exit(2)
    node_names.append(json.loads(pkg_json.read_text())["name"])

def emit_validator(out_path: str, runtime: str, names: list[str]) -> None:
    n = len(names)
    lines: list[str] = []
    lines.append("#!/usr/bin/env bash")
    lines.append(f"# .bin/docker/validate-{runtime}.sh — generated by")
    lines.append("# scripts/workspace/generate-package-validate.sh. DO NOT EDIT BY HAND.")
    lines.append("#")
    lines.append(f"# Asserts every {runtime} sibling listed below is installed in the image's")
    lines.append("# runtime (venv for python, node_modules for node). Replaces count-based")
    lines.append("# smoke checks (`pip list --editable | wc -l`) which can't name a missing")
    lines.append("# sibling. Sourced from .bin/docker/" + (
        "pyproject.docker.toml" if runtime == "python" else "pnpm-workspace.yaml"
    ) + "; regenerate via")
    lines.append("# scripts/workspace/generate-package-validate.sh after editing.")
    lines.append("set -euo pipefail")
    lines.append("")
    lines.append("PKGS=(")
    for name in names:
        lines.append(f"  {name}")
    lines.append(")")
    lines.append(f'EXPECTED={n}')
    lines.append("MISSING=()")
    lines.append("")
    if runtime == "python":
        lines.append("# Single pip-show invocation is fastest; per-name follow-up only when count")
        lines.append("# disagrees so we can report exactly which sibling is absent.")
        lines.append('GOT=$(pip show "${PKGS[@]}" 2>/dev/null | grep -c "^Name:" || true)')
        lines.append('if [[ "$GOT" -ne "$EXPECTED" ]]; then')
        lines.append('  for p in "${PKGS[@]}"; do')
        lines.append('    pip show "$p" >/dev/null 2>&1 || MISSING+=("$p")')
        lines.append("  done")
        lines.append('  echo "FAIL: expected $EXPECTED python siblings, got $GOT" >&2')
        lines.append('  for p in "${MISSING[@]}"; do echo "  MISSING: $p" >&2; done')
        lines.append("  exit 1")
        lines.append("fi")
        lines.append('echo "OK: $EXPECTED sibling packages installed"')
    else:  # node
        lines.append("# require.resolve fails with a non-zero exit when the package can't be")
        lines.append("# located on the resolution path — exactly the signal we want.")
        lines.append("GOT=0")
        lines.append('for p in "${PKGS[@]}"; do')
        lines.append('  if node -e "require.resolve(\'$p\')" >/dev/null 2>&1; then')
        lines.append("    GOT=$((GOT + 1))")
        lines.append("  else")
        lines.append('    MISSING+=("$p")')
        lines.append("  fi")
        lines.append("done")
        lines.append('if [[ "$GOT" -ne "$EXPECTED" ]]; then')
        lines.append('  echo "FAIL: expected $EXPECTED node siblings, got $GOT" >&2')
        lines.append('  for p in "${MISSING[@]}"; do echo "  MISSING: $p" >&2; done')
        lines.append("  exit 1")
        lines.append("fi")
        lines.append('echo "OK: $EXPECTED sibling packages installed"')
    Path(out_path).write_text("\n".join(lines) + "\n")

emit_validator(out_py, "python", py_names)
emit_validator(out_node, "node", node_names)
PY

install_or_check() {
  local tmp="$1" out="$2"
  if [[ $CHECK_MODE -eq 1 ]]; then
    if [[ ! -f "$out" ]]; then
      echo "FAIL: $out does not exist; regenerate via scripts/workspace/generate-package-validate.sh" >&2
      return 1
    fi
    if ! diff -q "$out" "$tmp" >/dev/null 2>&1; then
      echo "FAIL: $out is stale; regenerate via scripts/workspace/generate-package-validate.sh" >&2
      diff -u "$out" "$tmp" >&2 || true
      return 1
    fi
    echo "OK: $out is up to date"
  else
    mkdir -p "$(dirname "$out")"
    mv "$tmp" "$out"
    chmod +x "$out"
    echo "wrote: $out"
  fi
}

rc=0
install_or_check "$TMP_PY"   "$OUT_PY"   || rc=1
install_or_check "$TMP_NODE" "$OUT_NODE" || rc=1
exit "$rc"
