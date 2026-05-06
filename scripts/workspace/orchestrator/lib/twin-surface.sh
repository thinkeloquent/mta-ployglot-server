#!/usr/bin/env bash
# twin-surface.sh — extract the public surface of one twin (routes, lifecycles,
# env keys) in a normalized JSON-line shape.
#
# Functions:
#   twin_surface::routes <twin>          — static-regex route extraction
#   twin_surface::routes_runtime <twin>  — runtime emitter (loads addons, captures registrations)
#   twin_surface::lifecycles <twin>      — lifecycle file enumeration
#   twin_surface::env_keys <twin>        — env-key extraction (delegates to extract-vault-keys.sh)
#   twin_surface::all <twin>             — concatenates all three with `surface` field
#
# All functions emit one JSON object per surface item on stdout.
#
# Path normalization: Fastify and FastAPI spell the same path concepts
# differently. Both `routes` and `routes_runtime` post-process the FastAPI
# output to canonicalize on Fastify form so twin-diff compares like-for-like:
#
#   wildcard:  /{name:path}  (FastAPI/Starlette)  →  /*       (Fastify)
#   param:     /{name}       (FastAPI)            →  /:name   (Fastify)
#
# The wildcard rewrite runs first; otherwise the plain-param pass would
# mangle `{stage:path}` into `:stage:path`.
# shellcheck disable=SC2148

# Resolve our orchestrator dir from the path of THIS sourced file.
__TWIN_SURFACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Rewrite FastAPI/Starlette path templates to Fastify form on the `.path`
# field of the streaming JSON-line input. Idempotent on Fastify input.
__twin_surface_normalize_paths() {
  jq -c 'if has("path") then .path |= (gsub("/\\{[^}]+:path\\}"; "/*") | gsub("\\{(?<n>[^}]+)\\}"; ":\(.n)")) else . end'
}

twin_surface::routes() {
  local twin="$1"
  local dir="server/$twin/config/routes"
  [[ -d "$dir" ]] || return 0

  if [[ "$twin" == "fastify" ]]; then
    # fastify.get('/path', ...)  |  fastify.post(...)  |  app.get(...)
    # Uses perl in slurp mode (-0777) so the regex spans newlines — handles
    # the common `fastify.get(\n  "/path",\n  async (...) => {})` style that
    # a line-oriented grep would miss. Emits one TSV record per match
    # (method TAB path TAB file TAB line); the bash loop converts to JSON.
    find "$dir" -type f \( -name '*.mjs' -o -name '*.js' \) -not -path '*/node_modules/*' -print0 \
      | xargs -0 perl -0777 -ne '
          while (m{\b(?:fastify|app)\.(get|post|put|delete|patch|head|options)\s*\(\s*["\x27]([^"\x27]+)["\x27]}g) {
            my $method = uc($1);
            my $path   = $2;
            my $line   = (substr($_, 0, $-[0]) =~ tr/\n//) + 1;
            print "$method\t$path\t$ARGV\t$line\n";
          }
        ' 2>/dev/null \
      | while IFS=$'\t' read -r method path file line; do
          [[ -n "$method" && -n "$path" ]] || continue
          jq -nc --arg twin "$twin" --arg method "$method" --arg path "$path" \
            --arg file "$file" --argjson line "$line" \
            '{twin:$twin, method:$method, path:$path, file:$file, line:$line}'
        done
  elif [[ "$twin" == "fastapi" ]]; then
    # @router.get('/path')  |  @app.post(...)
    grep -rEn --include='*.py' \
      --exclude-dir=__pycache__ --exclude-dir=.venv \
      -e '@(app|router)\.(get|post|put|delete|patch|head|options)\(["\x27]' \
      "$dir" 2>/dev/null \
      | while IFS=: read -r file line content; do
          method=$(echo "$content" | grep -oE '@(app|router)\.(get|post|put|delete|patch|head|options)\(' | head -1 | sed -E 's/@(app|router)\.(.*)\(/\2/')
          path=$(echo "$content" | sed -nE 's/.*@(app|router)\.(get|post|put|delete|patch|head|options)\(["\x27]([^"\x27]+)["\x27].*/\3/p')
          if [[ -n "$method" && -n "$path" ]]; then
            method_upper=$(echo "$method" | tr '[:lower:]' '[:upper:]')
            jq -nc --arg twin "$twin" --arg method "$method_upper" --arg path "$path" \
              --arg file "$file" --argjson line "$line" \
              '{twin:$twin, method:$method, path:$path, file:$file, line:$line}'
          fi
        done | __twin_surface_normalize_paths
  fi
}

twin_surface::routes_runtime() {
  local twin="$1"
  case "$twin" in
    fastify)
      node "$__TWIN_SURFACE_DIR/../../../server/fastify/bin/emit-route-manifest.mjs" 2>/dev/null
      ;;
    fastapi)
      # Prefer the fastapi venv's python so the addons' real deps (httpx,
      # fastapi, fastapi_server, etc.) resolve. Fall back to system python3
      # — the script degrades gracefully (WARN per addon, no JSON to stdout).
      local venv_py="server/fastapi/.venv/bin/python"
      if [[ -x "$venv_py" ]]; then
        "$venv_py" "$__TWIN_SURFACE_DIR/../../../server/fastapi/bin/emit_route_manifest.py" 2>/dev/null \
          | __twin_surface_normalize_paths
      else
        python3 "$__TWIN_SURFACE_DIR/../../../server/fastapi/bin/emit_route_manifest.py" 2>/dev/null \
          | __twin_surface_normalize_paths
      fi
      ;;
    *) printf 'twin_surface::routes_runtime: unknown twin %s\n' "$twin" >&2; return 64 ;;
  esac
}

twin_surface::lifecycles() {
  local twin="$1"
  local dir="server/$twin/config/lifecycles"
  [[ -d "$dir" ]] || return 0
  find "$dir" -maxdepth 1 -type f \( -name '*.mjs' -o -name '*.py' \) -not -name '_*' 2>/dev/null \
    | sort \
    | while read -r f; do
        base=$(basename "$f")
        # Strip leading NN_ prefix and trailing .lifecycle.{mjs,py} extension
        name=$(echo "$base" | sed -E 's/^[0-9]+_//; s/\.(lifecycle\.)?(mjs|py)$//')
        jq -nc --arg twin "$twin" --arg name "$name" --arg file "$f" \
          '{twin:$twin, name:$name, file:$file}'
      done
}

twin_surface::env_keys() {
  local twin="$1"
  "$__TWIN_SURFACE_DIR/extract-vault-keys.sh" --twin "$twin" --json 2>/dev/null \
    | jq -c '{twin: .twin, key: .key}'
}

twin_surface::all() {
  local twin="$1"
  twin_surface::routes "$twin"     | jq -c '. + {surface: "route"}'
  twin_surface::lifecycles "$twin" | jq -c '. + {surface: "lifecycle"}'
  twin_surface::env_keys "$twin"   | jq -c '. + {surface: "env"}'
}
