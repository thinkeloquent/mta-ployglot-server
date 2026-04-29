#!/usr/bin/env node
// F02 / story 01 — load 9 fixtures from server/config/, prove merge + idempotent init.
import { AppYamlConfig } from "@ployglot/app-yaml-config";
import { loadFromConfigDir } from "@ployglot/app-yaml-loader";
import { CONFIG_DIR, resetAndInit, stable } from "./_init.mjs";

const inst = await resetAndInit();
const loaded = await loadFromConfigDir({ configDir: CONFIG_DIR });
const inst2 = await AppYamlConfig.initialize({ loaded });

console.log(stable({
  config_dir: CONFIG_DIR,
  top_level_keys: Object.keys(inst.getAll()).sort(),
  file_count: inst.getOriginalAll().size,
  same_instance: inst === inst2,
}));
