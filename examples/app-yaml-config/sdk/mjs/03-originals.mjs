#!/usr/bin/env node
// F02 / story 03 — getOriginal + getOriginalAll: per-file pre-merge snapshots.
import { resetAndInit, stable } from "./_init.mjs";

const inst = await resetAndInit();
const originals = inst.getOriginalAll();

const serverDevYaml = inst.getOriginal("server.dev.yaml") ?? null;

console.log(stable({
  original_files: [...originals.keys()].sort(),
  file_count: originals.size,
  server_dev_yaml_top_keys: serverDevYaml ? Object.keys(serverDevYaml).sort() : null,
  base_yaml_pre_merge: inst.getOriginal("base.yml") ?? null,
  nonexistent_file_lookup: inst.getOriginal("nonexistent.yml") ?? null,
}));
