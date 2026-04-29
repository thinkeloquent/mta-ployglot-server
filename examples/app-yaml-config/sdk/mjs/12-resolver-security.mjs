#!/usr/bin/env node
// F03 / story 04 — security guard rejects __proto__ etc.
import { createResolver, SecurityError } from "@ployglot/runtime-template-resolver";

const r = createResolver();
const out = {};

try {
  await r.resolve("{{__proto__.polluted}}", { __proto__: { polluted: "evil" } });
  out.proto_attempt = "<unexpected: did not throw>";
} catch (e) {
  out.proto_attempt = e instanceof SecurityError
    ? "<caught: SecurityError>"
    : `<caught: ${e.constructor.name}>`;
}

try {
  await r.resolve("{{constructor.name}}", {});
  out.constructor_attempt = "<unexpected: did not throw>";
} catch (e) {
  out.constructor_attempt = e instanceof SecurityError
    ? "<caught: SecurityError>"
    : `<caught: ${e.constructor.name}>`;
}

console.log(JSON.stringify(out, null, 2));
