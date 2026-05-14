// Slot 24 — discover server/computed_functions/*.compute.mjs and register each into a
// ComputeRegistry decorated as `compute_registry`. Slot 26 reads it.
//
// Multi-root: COMPUTE_FUNCTIONS_DIRS env (colon-separated, like PATH). Defaults to
// $APP_YAML_FIXTURES_DIR/../computed_functions if set, else import.meta.url-relative.
// Last-wins on name collision; structured WARN per collision.
// Validation: signature (must be callable) + scope (STARTUP|REQUEST). Bad files skip
// with reason recorded in the ledger; boot does NOT abort unless
// COMPUTE_FUNCTIONS_REQUIRE_AT_LEAST_ONE=true and zero functions register.
import fp from "fastify-plugin";
import { ComputeRegistry, ComputeScope } from "@ployglot/runtime-template-resolver";
import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FALLBACK_ROOT = resolve(
  process.env.APP_YAML_FIXTURES_DIR
    ? resolve(process.env.APP_YAML_FIXTURES_DIR, "..", "computed_functions")
    : resolve(HERE, "../../../computed_functions")
);

const VALID_SCOPES = new Set(["STARTUP", "REQUEST"]);

function pickRoots() {
  const env = process.env.COMPUTE_FUNCTIONS_DIRS;
  if (env && env.length) return env.split(":").filter(Boolean);
  return [FALLBACK_ROOT];
}

function nameFromFilename(file) {
  return basename(file).replace(/^\d+_/, "").replace(/\.compute\.mjs$/, "");
}

async function plugin(fastify, _opts) {
  const ledger = {
    event: "compute_functions_registered",
    count: 0,
    roots: [],
    registered: [],
    skipped: [],
    collisions: [],
  };
  const registry = new ComputeRegistry();
  const seen = new Map(); // name → source path (for collision detection)

  for (const root of pickRoots()) {
    if (!existsSync(root) || !statSync(root).isDirectory()) {
      fastify.log.warn({ event: "compute_root_missing", path: root });
      continue;
    }
    ledger.roots.push(root);
    const files = readdirSync(root).filter((f) => f.endsWith(".compute.mjs")).sort();
    for (const f of files) {
      const file = resolve(root, f);
      const name = nameFromFilename(file);
      let mod;
      try {
        mod = await import(pathToFileURL(file).href);
      } catch (err) {
        ledger.skipped.push({ file, reason: `import failed: ${err.message}` });
        continue;
      }
      if (typeof mod.default !== "function") {
        ledger.skipped.push({ file, reason: `not a callable (typeof default = ${typeof mod.default})` });
        continue;
      }
      let scope = mod.scope;
      if (scope === undefined) {
        fastify.log.info({ event: "compute_function_scope_default", file, default: "REQUEST" });
        scope = "REQUEST";
      } else if (!VALID_SCOPES.has(scope)) {
        ledger.skipped.push({ file, reason: `invalid scope '${scope}' (expected STARTUP|REQUEST)` });
        continue;
      }
      if (seen.has(name)) {
        ledger.collisions.push({ name, previous_source: seen.get(name), new_source: file });
        fastify.log.warn({ event: "compute_function_collision", name, previous_source: seen.get(name), new_source: file });
      }
      seen.set(name, file);
      registry.register(name, mod.default, scope === "STARTUP" ? ComputeScope.STARTUP : ComputeScope.REQUEST);
      // Replace any earlier ledger entry for this name (last-wins).
      ledger.registered = ledger.registered.filter((e) => e.name !== name);
      ledger.registered.push({ name, scope, source: file });
    }
  }
  ledger.count = ledger.registered.length;

  if (ledger.count === 0 && process.env.COMPUTE_FUNCTIONS_REQUIRE_AT_LEAST_ONE === "true") {
    throw new Error("compute_functions: zero functions registered and COMPUTE_FUNCTIONS_REQUIRE_AT_LEAST_ONE=true");
  }

  fastify.decorate("compute_registry", registry);
  fastify.decorate("compute_registry_ledger", ledger);
  fastify.log.info(ledger);
}

const wrapped = fp(plugin, { name: "compute-functions", fastify: ">=4" });

export default async function lifecycle(server, _config) {
  await server.register(wrapped);
}
