// @ts-nocheck
import { test } from "node:test";
import assert from "node:assert/strict";
import { Registry } from "../src/registry/registry.js";
import { createContext } from "../src/registry/ctx.js";
import type { RuntimeAdapter } from "../src/adapters/adapter.js";
import type { ResolvedBootstrapConfig, HookCollector } from "../src/contract/index.js";
import { createLoaderReport } from "../src/contract/index.js";

function fakeAdapter(): RuntimeAdapter<object> {
  return {
    name: "fake",
    createServer: () => ({}),
    decorate() {},
    hasDecorator() {
      return false;
    },
    onClose() {},
    attachRequestState() {},
    registerGracefulShutdown() {},
    scheduleHooks() {},
    registerRoutes() {},
  };
}

const cfg: ResolvedBootstrapConfig = {
  title: "t",
  port: 1,
  host: "h",
  paths: { environment: [], lifecycles: [], routes: [], apps: [] },
  initial_state: {},
};

test("Registry: priority ordering then insertion order", () => {
  const reg = new Registry();
  reg.register({ name: "b", priority: 20, run: () => createLoaderReport("b") });
  reg.register({ name: "a", priority: 10, run: () => createLoaderReport("a") });
  reg.register({ name: "c", priority: 20, run: () => createLoaderReport("c") });
  const names = reg.list().map((a) => a.name);
  assert.deepEqual(names, ["a", "b", "c"]);
});

test("Registry.runAll: isolates thrown addon", async () => {
  const reg = new Registry<object>();
  reg.register({ name: "ok", priority: 10, run: () => createLoaderReport("ok") });
  reg.register({
    name: "boom",
    priority: 20,
    run: () => {
      throw new Error("kaboom");
    },
  });
  reg.register({ name: "ok2", priority: 30, run: () => createLoaderReport("ok2") });

  const hooks: HookCollector = { init: [], startup: [], shutdown: [] };
  const ctx = createContext(fakeAdapter(), cfg, hooks);
  const server = {};
  const reports = await reg.runAll(server, cfg, ctx);
  assert.equal(reports.ok.errors.length, 0);
  assert.equal(reports.boom.errors.length, 1);
  assert.match(reports.boom.errors[0]!.error, /kaboom/);
  assert.equal(reports.ok2.errors.length, 0);
});
