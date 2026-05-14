import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { setupRouteCollector, printRoutes } from "../src/index.mjs";

test("printRoutes prints collected routes in sorted order", async () => {
  const app = Fastify({ logger: false, exposeHeadRoutes: false });
  setupRouteCollector(app);

  app.get("/hello", async () => ({ ok: true }));
  app.post("/echo", async () => ({ ok: true }));
  app.get("/echo", async () => ({ ok: true }));

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
  assert.match(joined, /\/echo\s+\|\s+GET, POST/);
  assert.match(joined, /\/hello\s+\|\s+GET/);
});
