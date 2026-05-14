// Shared bootstrap: load 9 fixtures from server/config/, init AppYamlConfig
// singleton, return the instance. Each example imports this and calls
// resetAndInit() at the top so it's re-runnable in isolation.

import { AppYamlConfig } from "@ployglot/app-yaml-config";
import { loadFiles } from "@ployglot/app-yaml-loader";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { basename, dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
// mta-ployglot-server/examples/sdk/mjs/ → ../../../server/config
export const CONFIG_DIR = resolve(HERE, "../../../server/config");

export async function resetAndInit() {
  AppYamlConfig._resetForTesting();
  // Load EVERY *.yml/*.yaml in CONFIG_DIR (the loader's default base set is only 6).
  const files = readdirSync(CONFIG_DIR)
    .filter((f) => /\.ya?ml$/.test(f))
    .sort()
    .map((f) => resolve(CONFIG_DIR, f));
  const fullKeyMap = await loadFiles(files);
  // Re-key by basename so getOriginal('base.yml') resolves cleanly.
  const loaded = new Map();
  for (const [k, v] of fullKeyMap.entries()) loaded.set(basename(k), v);
  return AppYamlConfig.initialize({ loaded });
}

// Stable JSON: sorted keys, no trailing newline (caller adds).
export function stable(obj) {
  return JSON.stringify(obj, (_k, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.keys(v).sort().reduce((o, k) => { o[k] = v[k]; return o; }, {});
    }
    return v;
  }, 2);
}
