#!/usr/bin/env node
// F03 / story 04 — STARTUP cache, REQUEST fresh, REQUEST-in-STARTUP literal rule.
import { ComputeRegistry, ComputeScope, MissingStrategy, createResolver } from "@ployglot/runtime-template-resolver";

// SDK note: COMPUTE_PATTERN regex permits no dots in fn name (see 08-resolver-fn).
// Use bare {{fn:foo}} and dot-access programmatically.
const reg = new ComputeRegistry();
let counter = 0;
reg.register("startup_tokens", () => ++counter, ComputeScope.STARTUP);
reg.register("request_token",  () => ++counter, ComputeScope.REQUEST);

const r = createResolver({ registry: reg, missingStrategy: MissingStrategy.IGNORE });

const startup_first = await r.resolve("{{fn:startup_tokens}}", {}, ComputeScope.REQUEST);
const startup_second = await r.resolve("{{fn:startup_tokens}}", {}, ComputeScope.REQUEST);
const request_first = await r.resolve("{{fn:request_token}}", {}, ComputeScope.REQUEST);
const request_second = await r.resolve("{{fn:request_token}}", {}, ComputeScope.REQUEST);
const request_in_startup = await r.resolve("{{fn:request_token}}", {}, ComputeScope.STARTUP);

console.log(JSON.stringify({
  startup_first,
  startup_second,
  startup_cached: startup_first === startup_second,
  request_first,
  request_second,
  request_fresh: request_first !== request_second,
  request_in_startup_context: request_in_startup,
  request_in_startup_is_literal: request_in_startup === "{{fn:request_token}}",
}, null, 2));
