#!/usr/bin/env node
// vault-probe.mjs — check that each KEY argument resolves to a non-empty
// value in process.env. Emits one JSON line per key on stdout.
//
// DEVIATION FROM PLAN: the plan called this a "vault probe" against a vault
// module. The codebase has no vault module — env keys come straight from
// process.env. This probe checks that source directly.
//
// Usage: node vault-probe.mjs KEY1 KEY2 KEY3 ...

for (const key of process.argv.slice(2)) {
  const v = process.env[key];
  const ok = typeof v === "string" && v.length > 0;
  process.stdout.write(
    JSON.stringify({
      key,
      twin: "fastify",
      ok,
      value_length: ok ? v.length : null,
    }) + "\n",
  );
}
