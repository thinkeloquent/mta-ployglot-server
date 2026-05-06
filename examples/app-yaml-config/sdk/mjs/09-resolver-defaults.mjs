#!/usr/bin/env node
// F03 / story 04 — parseDefault: string / null / numeric coercion.
import { createResolver, MissingStrategy } from "@ployglot/runtime-template-resolver";

const r = createResolver({ missingStrategy: MissingStrategy.IGNORE });

const out = {
  env_default_string: await r.resolve('{{env.NEVER_SET | "fallback"}}', { env: process.env }),
  fn_default_null: await r.resolve("{{fn:nope | null}}", {}),
  app_default_numeric: await r.resolve('{{app.x | "5000"}}', {}),
};
console.log(JSON.stringify(out, null, 2));
