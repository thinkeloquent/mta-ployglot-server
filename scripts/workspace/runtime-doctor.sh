#!/usr/bin/env bash
# runtime-doctor.sh — diagnose the dev / prod runtime install state.
#
# Complementary to doctor.sh (which checks workspace topology). This one
# checks the things that bite during `make dev` / `make prod`:
#
#   - host tools (node / npm / uv / python3) present + at expected versions
#   - env state for TLS / registry knobs (UV_NATIVE_TLS, SSL_CERT_FILE,
#     PYTHON_REGISTRY_URL, UV_INDEX_URL, NPM_REGISTRY, proxy vars)
#   - TLS reachability against the configured Python registry (curl probe;
#     curl uses the macOS Keychain, so a curl PASS + uv FAIL → flip
#     UV_NATIVE_TLS=true to make uv read the same trust store)
#   - uv resolver smoke (`uv pip install --dry-run uvicorn` in a temp venv)
#   - sibling layout under ployglots/ (symlink vs. real-dir; missing entries)
#   - mode-specific staging dir (.dev/ or .prod/) — venv health, node_modules
#     sibling shape (symlinks expected in dev, real dirs in prod)
#   - ports (FASTIFY_PORT / FASTAPI_PORT or their PROD_* overrides)
#
# USAGE
#   bash scripts/workspace/runtime-doctor.sh dev
#   bash scripts/workspace/runtime-doctor.sh prod
#
# Driven by Makefile targets `make dev-doctor` and `make prod-doctor`,
# which export the relevant vars before invocation.
#
# EXIT
#   0          — no FAIL findings (warnings allowed)
#   n > 0      — n FAIL findings
#   64         — usage error (EX_USAGE)

# NOTE: deliberately NOT `set -e`. Diagnostics must run every check even
# when earlier ones fail; we surface failures via exit-code aggregation.
set -uo pipefail

MODE="${1:-}"
case "$MODE" in
  dev|prod) ;;
  -h|--help) sed -n '2,/^# EXIT/p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
  *) echo "usage: $0 dev|prod" >&2; exit 64 ;;
esac

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${ROOT_DIR:-$(cd "$SELF_DIR/../.." && pwd)}"

# Mode-specific paths/ports. Each falls back to a sensible default so the
# script also works when invoked directly (without the Makefile exporting).
if [[ "$MODE" == "dev" ]]; then
  STAGE_DIR="${DEV_DIR:-$ROOT_DIR/.dev}"
  STAGE_FASTIFY_APP="${DEV_FASTIFY_APP:-$STAGE_DIR/fastify-app}"
  STAGE_VENV="${DEV_VENV:-$STAGE_DIR/fastapi/.venv}"
  STAGE_FASTIFY_PORT="${FASTIFY_PORT:-5100}"
  STAGE_FASTAPI_PORT="${FASTAPI_PORT:-5200}"
else
  STAGE_DIR="${PROD_DIR:-$ROOT_DIR/.prod}"
  STAGE_FASTIFY_APP="${PROD_FASTIFY_APP:-$STAGE_DIR/fastify-app}"
  STAGE_VENV="${PROD_VENV:-$STAGE_DIR/fastapi/.venv}"
  STAGE_FASTIFY_PORT="${PROD_FASTIFY_PORT:-${FASTIFY_PORT:-5100}}"
  STAGE_FASTAPI_PORT="${PROD_FASTAPI_PORT:-${FASTAPI_PORT:-5200}}"
fi

# ----- formatting helpers -----
if [[ -t 1 ]]; then
  C_GREEN=$'\033[32m'; C_RED=$'\033[31m'; C_YELLOW=$'\033[33m'
  C_DIM=$'\033[2m'; C_RESET=$'\033[0m'
else
  C_GREEN=""; C_RED=""; C_YELLOW=""; C_DIM=""; C_RESET=""
fi
WARN_COUNT=0
FAIL_COUNT=0
ok()   { printf "  [%sOK%s]   %s\n"   "$C_GREEN"  "$C_RESET" "$1"; }
warn() { printf "  [%sWARN%s] %s\n"   "$C_YELLOW" "$C_RESET" "$1"; WARN_COUNT=$((WARN_COUNT+1)); }
fail() { printf "  [%sFAIL%s] %s\n"   "$C_RED"    "$C_RESET" "$1"; FAIL_COUNT=$((FAIL_COUNT+1)); }
note() { printf "         %s%s%s\n"   "$C_DIM"    "$1"       "$C_RESET"; }

echo ""
printf "==> %s-doctor — diagnosing %s mode\n" "$MODE" "$MODE"
printf "    %sROOT_DIR=%s%s\n" "$C_DIM" "$ROOT_DIR" "$C_RESET"
printf "    %sSTAGE_DIR=%s%s\n" "$C_DIM" "$STAGE_DIR" "$C_RESET"
echo ""

# ===== 1. host tools =====
echo "[host]"
for t in node npm uv python3; do
  if command -v "$t" >/dev/null 2>&1; then
    v="$("$t" --version 2>&1 | head -1)"
    ok "$t — $v"
  else
    fail "$t — MISSING (Step 0 of docs/setup-branch.md)"
  fi
done
echo ""

# ===== 2. env state =====
echo "[env]"
print_env() {
  local name="$1"
  local val="${!name:-}"
  if [[ -z "$val" || "$val" == "0" || "$val" == "None" || "$val" == "NONE" ]]; then
    note "$name = <unset>"
  else
    note "$name = $val"
  fi
}
for var in \
  UV_NATIVE_TLS SSL_CERT_FILE NODE_EXTRA_CA_CERTS \
  PYTHON_REGISTRY_URL UV_INDEX_URL UV_DEFAULT_INDEX PIP_INDEX_URL \
  NPM_REGISTRY \
  NO_PROXY HTTPS_PROXY HTTP_PROXY; do
  print_env "$var"
done
# macOS hint: corp users typically need UV_NATIVE_TLS to make uv consult
# the System Keychain (where IT-pushed root CAs live). This is opt-in by
# design — public-PyPI users do not need it.
if [[ "$(uname -s)" == "Darwin" \
      && ( -z "${UV_NATIVE_TLS:-}" || "${UV_NATIVE_TLS:-0}" == "0" ) ]]; then
  note "$C_YELLOW""hint:"$C_RESET" if 'uv pip install' fails with UnknownIssuer, add UV_NATIVE_TLS=true to .env"
fi
echo ""

# ===== 3. TLS reachability — curl probes the Python registry =====
echo "[tls reachability]"
PROBE_URL=""
for v in UV_INDEX_URL UV_DEFAULT_INDEX PYTHON_REGISTRY_URL PIP_INDEX_URL; do
  vv="${!v:-}"
  if [[ -n "$vv" ]]; then PROBE_URL="$vv"; break; fi
done
if [[ -z "$PROBE_URL" ]]; then
  note "no UV_INDEX_URL / PYTHON_REGISTRY_URL set — uv will use its built-in default index"
else
  url="${PROBE_URL%/}/uvicorn/"
  http_code="$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || echo "")"
  case "$http_code" in
    200|301|302|307|308|401|403)
      ok "curl $url → HTTP $http_code (TLS chain trusted by curl/Keychain)"
      [[ -z "${UV_NATIVE_TLS:-}" || "${UV_NATIVE_TLS:-0}" == "0" ]] && \
        note "curl trusts the cert; uv may not. If you see UnknownIssuer, set UV_NATIVE_TLS=true."
      ;;
    "")
      fail "curl $url → connection failed"
      err_msg="$(curl -sS --max-time 10 "$url" 2>&1 | head -3 | tr '\n' ' ' || true)"
      [[ -n "$err_msg" ]] && note "curl: $err_msg"
      note "fix: check that your network allows $PROBE_URL, or unset PYTHON_REGISTRY_URL in .env"
      ;;
    *)
      warn "curl $url → HTTP $http_code (unexpected; check upstream registry)"
      ;;
  esac
fi
echo ""

# ===== 4. uv resolver smoke =====
echo "[uv resolver]"
if ! command -v uv >/dev/null 2>&1; then
  fail "uv missing — cannot run resolver test"
else
  tmproot="$(mktemp -d -t runtime-doctor.XXXXXX)"
  tmpvenv="$tmproot/uv-doctor-venv"
  if uv venv --python "${UV_PYTHON:-3.11}" "$tmpvenv" >/dev/null 2>&1; then
    if out="$(uv pip install --python "$tmpvenv/bin/python" --dry-run uvicorn 2>&1)"; then
      ok "uv pip install --dry-run uvicorn → resolved against the configured index"
    else
      fail "uv pip install --dry-run uvicorn → failed"
      while IFS= read -r line; do
        [[ -n "$line" ]] && note "uv: $line"
      done <<< "$(printf '%s' "$out" | tail -6)"
      if grep -q -i "UnknownIssuer\|invalid peer certificate" <<< "$out"; then
        note "$C_YELLOW""fix:"$C_RESET" set UV_NATIVE_TLS=true in .env (uv ignores the macOS Keychain by default)"
      elif grep -q -i "ConnectError\|client error (Connect)" <<< "$out"; then
        note "fix: check network reachability to the configured PYTHON_REGISTRY_URL"
      fi
    fi
  else
    warn "uv venv failed in $tmpvenv — skipping resolver test"
  fi
  rm -rf "$tmproot"
fi
echo ""

# ===== 5. sibling layout under ployglots/ =====
echo "[siblings (ployglots/)]"
SIBLINGS=(
  mta-ployglot-server-bootstrap
  mta-ployglot-server-print-routes
  mta-ployglot-pkg-fetch-client
  mta-ployglot-pkg-env-resolve
  mta-ployglot-pkg-app-yaml-loader
  mta-ployglot-pkg-app-yaml-overwrite
  mta-ployglot-pkg-app-yaml-config
  mta-ployglot-pkg-app-yaml-fetch-config
)
for entry in "${SIBLINGS[@]}"; do
  p="$ROOT_DIR/ployglots/$entry"
  if [[ -L "$p" ]]; then
    target="$(readlink "$p")"
    if [[ -d "$p/" ]]; then
      ok "$entry — symlink → $target"
    else
      fail "$entry — symlink → $target (BROKEN)"
    fi
  elif [[ -d "$p" ]]; then
    ok "$entry — real directory (release/main mode)"
  else
    fail "$entry — MISSING (run: make bootstrap)"
  fi
done
echo ""

# ===== 6. staging dir =====
echo "[staging $STAGE_DIR]"
if [[ ! -d "$STAGE_DIR" ]]; then
  warn "$STAGE_DIR/ does not exist — run 'make $MODE' (or 'make $MODE-install') first"
else
  ok "$STAGE_DIR/ exists"
  if [[ -x "$STAGE_VENV/bin/python" ]]; then
    pyv="$("$STAGE_VENV/bin/python" --version 2>&1 || echo unknown)"
    ok "$STAGE_VENV/bin/python — $pyv"
  else
    warn "$STAGE_VENV/bin/python missing — run 'make $MODE-install-fastapi'"
  fi
  if [[ -d "$STAGE_FASTIFY_APP/node_modules" ]]; then
    ok "$STAGE_FASTIFY_APP/node_modules — populated"
    sibling_path="$STAGE_FASTIFY_APP/node_modules/fastify-server"
    if [[ -L "$sibling_path" ]]; then
      target="$(readlink "$sibling_path")"
      if [[ "$MODE" == "dev" ]]; then
        ok "node_modules/fastify-server — symlink → $target (dev: live edits flow)"
      else
        warn "node_modules/fastify-server is a symlink (prod expects a frozen copy)"
        note "fix: rm -rf $sibling_path && make prod-install-fastify"
      fi
    elif [[ -d "$sibling_path" ]]; then
      if [[ "$MODE" == "prod" ]]; then
        ok "node_modules/fastify-server — directory (prod: frozen)"
      else
        warn "node_modules/fastify-server is a real directory (dev expects symlink)"
        note "fix: make dev-install-fastify (re-establishes the symlink)"
      fi
    else
      warn "node_modules/fastify-server missing — run 'make $MODE-install-fastify'"
    fi
  else
    warn "$STAGE_FASTIFY_APP/node_modules missing — run 'make $MODE-install-fastify'"
  fi
fi
echo ""

# ===== 7. ports =====
echo "[ports]"
for pair in "$STAGE_FASTIFY_PORT:fastify" "$STAGE_FASTAPI_PORT:fastapi"; do
  port="${pair%%:*}"
  label="${pair##*:}"
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN -nP 2>/dev/null || true)"
  if [[ -z "$pids" ]]; then
    ok "port $port ($label) — free"
  else
    cmds="$(ps -o comm= -p $pids 2>/dev/null | sort -u | tr '\n' ' ' | sed 's/ $//' || echo "?")"
    warn "port $port ($label) — in use by PID(s) $pids ($cmds)"
    note "stop with: make $MODE-stop"
  fi
done
echo ""

# ===== summary =====
echo "================================================================"
if [[ $FAIL_COUNT -eq 0 && $WARN_COUNT -eq 0 ]]; then
  printf "  %sOK%s — no issues found\n" "$C_GREEN" "$C_RESET"
elif [[ $FAIL_COUNT -eq 0 ]]; then
  printf "  %sWARN%s — %d warning(s); %s should still work\n" \
    "$C_YELLOW" "$C_RESET" "$WARN_COUNT" "make $MODE"
else
  printf "  %sFAIL%s — %d failure(s), %d warning(s); %s will likely fail\n" \
    "$C_RED" "$C_RESET" "$FAIL_COUNT" "$WARN_COUNT" "make $MODE"
fi
echo "================================================================"
echo ""

exit "$FAIL_COUNT"
