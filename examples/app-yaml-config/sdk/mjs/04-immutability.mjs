#!/usr/bin/env node
// F02 / story 04 — immutability + restore.
//   (1) deep-clone safety: getter mutations cannot poison singleton.
//   (2) mutation API throws ImmutabilityError.
//   (3) restore() resets _config back to post-init snapshot.
import { ImmutabilityError } from "@ployglot/app-yaml-config";
import { resetAndInit } from "./_init.mjs";

const inst = await resetAndInit();
const ORIG_BASE_URL = inst.getNested(["providers", "openai", "base_url"]);

// (1) deep-clone safety
const a = inst.getNested(["providers", "openai"]);
a.base_url = "hacked-by-caller";
const b = inst.getNested(["providers", "openai"]);
if (b.base_url !== ORIG_BASE_URL) {
  console.error("FAIL: deep-clone broken — caller mutation poisoned singleton");
  process.exit(1);
}

// (2) mutation API rejection
for (const m of ["set", "update", "reset", "clear"]) {
  let ok = false;
  try { inst[m]("x", 1); }
  catch (e) { ok = e instanceof ImmutabilityError; }
  if (!ok) { console.error(`FAIL: ${m}() did not throw ImmutabilityError`); process.exit(1); }
}

// (3) restore cycle (privileged in-memory mutation, then restore)
inst._config.providers.openai.base_url = "changed-by-privileged";
if (inst.getNested(["providers", "openai", "base_url"]) !== "changed-by-privileged") {
  console.error("FAIL: privileged mutation not visible"); process.exit(1);
}
inst.restore();
if (inst.getNested(["providers", "openai", "base_url"]) !== ORIG_BASE_URL) {
  console.error("FAIL: restore() did not reset to initial snapshot"); process.exit(1);
}

console.log(JSON.stringify({
  invariants_passed: ["deep_clone_safe", "set_throws", "update_throws", "reset_throws", "clear_throws", "restore_resets"],
  original_openai_base_url: ORIG_BASE_URL,
}, null, 2));
