#!/usr/bin/env node
// F03 / story 02 — {{env.X}} + default-value syntax.
import { createResolver, MissingStrategy } from "@ployglot/runtime-template-resolver";

const resolver = createResolver({ missingStrategy: MissingStrategy.IGNORE });

const out = {
  home_set: !!process.env.HOME,
  default_when_unset: await resolver.resolve('{{env.NEVER_SET_BY_TEST | "default-here"}}', { env: process.env }),
  default_numeric: await resolver.resolve('{{env.ALSO_NEVER_SET | "42"}}', { env: process.env }),
};
// Don't print actual $HOME (host-specific) — just confirm it resolves.
out.home_resolved = (await resolver.resolve("{{env.HOME}}", { env: process.env })) ? "<HOME>" : null;

console.log(JSON.stringify(out, null, 2));
