// _provider_config_echo.mjs — slice + resolve + mask provider config.
//
// Used by /healthz/integrations/* routes to add a `config_used` field
// showing the post-pipeline provider slice with templates resolved and
// credential keys masked. Twin of `_provider_config_echo.py`.
// Contract: AI-Agent-Plans/19/integration-config-echo-20260504-b3a1f29c/
//   stories/01/_provider_config_echo.contract.md.
//
// Deviation from plan: the contract requires a `trigger` parameter mapping to
// the engine's `ComputeScope.STARTUP` / `REQUEST`. Slot 26 attaches the raw
// `ContextResolver` directly to `request.runtime_template_resolver` (no handle
// wrapper), so we call `resolver.resolveObject(slice, ctx, scope)` with the
// scope explicitly. Slot 26 remains the single owner of `createResolver()`.

import { ComputeScope } from "@ployglot/runtime-template-resolver";

// Verbatim from contract doc. Case-insensitive flag.
export const CREDENTIAL_KEY_RE =
  /^(.*_)?(api_key|api_token|access_key|secret|password|token|client_secret)$/i;

// Verbatim from contract doc.
export const SENSITIVE_HEADER_NAMES = new Set([
  "authorization",
  "x-api-key",
  "x-auth-token",
  "cookie",
  "set-cookie",
]);

export const MASKED_LITERAL = "***";

const VALID_TRIGGERS = new Set(["OnStart", "OnRequest", "Both"]);

function buildRequestContext(request, cfg) {
  const headers = {};
  for (const [k, v] of Object.entries(request.headers ?? {})) {
    headers[k.toLowerCase()] = v;
  }
  return {
    app: cfg && typeof cfg === "object" ? cfg.app : undefined,
    request: { headers, method: request.method, path: request.url },
  };
}

async function resolveWithTrigger(resolver, slice, ctx, trigger) {
  if (trigger === "OnRequest") {
    return await resolver.resolveObject(slice, ctx, ComputeScope.REQUEST);
  }
  if (trigger === "OnStart") {
    return await resolver.resolveObject(slice, ctx, ComputeScope.STARTUP);
  }
  // "Both": STARTUP first, REQUEST over the partially-resolved tree.
  const startupPass = await resolver.resolveObject(
    slice,
    ctx,
    ComputeScope.STARTUP,
  );
  return await resolver.resolveObject(startupPass, ctx, ComputeScope.REQUEST);
}

export async function buildEcho({
  provider,
  request,
  cfg,
  resolver,
  trigger = "OnRequest",
}) {
  if (!VALID_TRIGGERS.has(trigger)) {
    throw new TypeError(
      `Invalid trigger ${JSON.stringify(trigger)}; expected one of OnStart, OnRequest, Both`,
    );
  }
  if (!cfg || typeof cfg !== "object") return null;
  const slice = cfg.providers?.[provider];
  if (!slice || typeof slice !== "object" || Array.isArray(slice)) return null;
  const ctx = buildRequestContext(request, cfg);
  const resolved = await resolveWithTrigger(resolver, slice, ctx, trigger);
  return _mask(resolved);
}

export function _mask(node, parentKey) {
  if (Array.isArray(node)) {
    return node.map((v) => _mask(v, parentKey));
  }
  if (node && typeof node === "object") {
    const isHeaders =
      typeof parentKey === "string" && parentKey.toLowerCase() === "headers";
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if (typeof k === "string" && CREDENTIAL_KEY_RE.test(k)) {
        out[k] = MASKED_LITERAL;
      } else if (
        isHeaders &&
        typeof k === "string" &&
        SENSITIVE_HEADER_NAMES.has(k.toLowerCase())
      ) {
        out[k] = MASKED_LITERAL;
      } else {
        out[k] = _mask(v, k);
      }
    }
    return out;
  }
  return node;
}
