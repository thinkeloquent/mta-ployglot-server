#!/usr/bin/env node
// F03 / story 04 — three MissingStrategy modes against {{env.NOT_SET}}.
import { createResolver, MissingStrategy, ComputeFunctionError } from "@ployglot/runtime-template-resolver";

const out = {};

// ERROR
try {
  const r = createResolver({ missingStrategy: MissingStrategy.ERROR });
  await r.resolve("{{env.NOT_SET}}", { env: {} });
  out.ERROR = "<unexpected: did not throw>";
} catch (e) {
  out.ERROR = e instanceof ComputeFunctionError ? "<caught: ComputeFunctionError>" : `<caught: ${e.constructor.name}>`;
}

// IGNORE
{
  const r = createResolver({ missingStrategy: MissingStrategy.IGNORE });
  out.IGNORE = await r.resolve("{{env.NOT_SET}}", { env: {} });
}

// DEFAULT
{
  const r = createResolver({ missingStrategy: MissingStrategy.DEFAULT });
  out.DEFAULT = (await r.resolve("{{env.NOT_SET}}", { env: {} })) ?? null;
}

console.log(JSON.stringify(out, null, 2));
