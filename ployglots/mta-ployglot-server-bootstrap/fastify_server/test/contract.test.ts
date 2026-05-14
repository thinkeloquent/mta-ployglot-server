// @ts-nocheck
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mergeConfig,
  resolvePaths,
  createLoaderReport,
  sortByNumericPrefix,
  validateBootstrapConfig,
  BootstrapConfigError,
} from "../src/contract/index.js";

test("mergeConfig: paths core-first, then user-last, absolute", () => {
  const merged = mergeConfig(
    { paths: { environment: "core/env" } },
    { paths: { environment: ["user/env1", "user/env2"] } },
    "/tmp/base",
  );
  assert.deepEqual(merged.paths.environment, [
    "/tmp/base/core/env",
    "/tmp/base/user/env1",
    "/tmp/base/user/env2",
  ]);
  assert.equal(merged.port, 3000);
  assert.equal(merged.host, "0.0.0.0");
  assert.equal(merged.title, "polyglot-server");
});

test("resolvePaths: missing keys default to empty array", () => {
  const r = resolvePaths(undefined, "/tmp");
  assert.deepEqual(r, { environment: [], lifecycles: [], routes: [], apps: [] });
});

test("validateBootstrapConfig: bad port throws", () => {
  assert.throws(() => validateBootstrapConfig({ port: 99999 }), BootstrapConfigError);
  assert.throws(() => validateBootstrapConfig({ port: -1 }), BootstrapConfigError);
  assert.throws(() => validateBootstrapConfig({ port: "x" }), BootstrapConfigError);
  assert.throws(() => validateBootstrapConfig({ paths: { weird: "x" } }), BootstrapConfigError);
});

test("createLoaderReport: canonical shape", () => {
  const r = createLoaderReport("env");
  assert.equal(r.name, "env");
  assert.equal(r.discovered, 0);
  assert.deepEqual(r.errors, []);
});

test("sortByNumericPrefix: 01 before 10 before plain", () => {
  const sorted = sortByNumericPrefix(["/a/10_foo", "/a/bar", "/a/01_baz"]);
  assert.deepEqual(sorted, ["/a/01_baz", "/a/10_foo", "/a/bar"]);
});
