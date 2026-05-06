#!/usr/bin/env node
// F03 / story 02 — {{app.X}} + {{request.X}} against synthetic context.
import { createResolver, MissingStrategy } from "@ployglot/runtime-template-resolver";

const resolver = createResolver({ missingStrategy: MissingStrategy.IGNORE });
const ctx = {
  app: { name: "demo", version: "1.2.3" },
  request: { headers: { "x-request-id": "req-001" }, method: "POST" },
};

const out = {
  "app.name": await resolver.resolve("{{app.name}}", ctx),
  "app.version": await resolver.resolve("{{app.version}}", ctx),
  "request.headers.x-request-id": await resolver.resolve("{{request.headers.x-request-id}}", ctx),
  "request.method": await resolver.resolve("{{request.method}}", ctx),
  missing_with_default: await resolver.resolve('{{app.missing.key | "n/a"}}', ctx),
};
console.log(JSON.stringify(out, null, 2));
