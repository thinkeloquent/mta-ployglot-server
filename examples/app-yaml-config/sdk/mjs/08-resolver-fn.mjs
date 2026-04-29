#!/usr/bin/env node
// F03 / story 03 — {{fn:foo}} + composite-property access via the SDK.
//
// Note: COMPUTE_PATTERN regex /^\{\{fn:([a-zA-Z_][a-zA-Z0-9_]*)(...)?\}\}$/ permits
// only [A-Za-z0-9_] in the fn name — no dots. Composite property syntax
// `{{fn:app_metadata.version}}` is therefore NOT a separate template form; it would
// fall through to TEMPLATE_PATTERN as a context lookup and miss. Instead, the
// composite pattern is: function returns object → consumer uses programmatic
// dot-access on the resolved value.
import { ComputeRegistry, ComputeScope, MissingStrategy, createResolver } from "@ployglot/runtime-template-resolver";

const reg = new ComputeRegistry();
reg.register("app_metadata", () => ({ name: "demo", version: "1.2.3", started_at: "2026-04-27T00:00:00Z" }), ComputeScope.STARTUP);
reg.register("request_id", () => crypto.randomUUID(), ComputeScope.REQUEST);

const r = createResolver({ registry: reg, missingStrategy: MissingStrategy.IGNORE });

const metadata = await r.resolve("{{fn:app_metadata}}", {}, ComputeScope.REQUEST);
const a = await r.resolve("{{fn:request_id}}", {}, ComputeScope.REQUEST);
const b = await r.resolve("{{fn:request_id}}", {}, ComputeScope.REQUEST);

console.log(JSON.stringify({
  metadata_full: metadata,
  metadata_version_via_property_access: metadata?.version,
  metadata_started_via_property_access: metadata?.started_at,
  request_id_first: "<uuid>",
  request_id_second: "<uuid>",
  request_fresh_per_call: a !== b,
  missing_fn_with_default: await r.resolve('{{fn:nope | "missing-fn-default"}}', {}, ComputeScope.REQUEST),
}, null, 2));
