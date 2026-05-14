import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { printRoutes } from "../src/index.mjs";

test("printRoutes falls back to fastify.printRoutes when collector is not attached", async () => {
  const app = Fastify({ logger: false });
  // Deliberately NOT calling setupRouteCollector.

  app.get("/ping", async () => ({ ok: true }));
  await app.ready();

  const logs = [];
  const orig = console.log;
  console.log = (...args) => logs.push(args.join(" "));
  try {
    printRoutes(app);
  } finally {
    console.log = orig;
  }
  await app.close();

  const joined = logs.join("\n");
  assert.match(joined, /Registered Routes - Fastify:/);
  assert.match(joined, /ping/, "fallback output should mention the registered route");
});
