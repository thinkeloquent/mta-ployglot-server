#!/usr/bin/env node
// emit-route-manifest.mjs — load every server/fastify/config/routes/30_*.routes.mjs
// in a sandbox with a route-collector mock and dump the canonical route inventory
// as JSON-lines on stdout.
//
// Used by twin-diff to detect dynamically-registered routes the static regex misses.
// WARN messages go to stderr; clean JSON-lines go to stdout.

import { readdirSync } from "node:fs";
import { resolve, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROUTES_DIR = resolve(HERE, "..", "config", "routes");

function dirname(p) {
  return p.substring(0, p.lastIndexOf("/"));
}

const collected = [];

function makeCollector(source) {
  const verb = (m) => (path /* , handler? */) => {
    collected.push({ source, method: m, path });
  };
  const noop = () => {};
  const mock = {
    get: verb("GET"),
    post: verb("POST"),
    put: verb("PUT"),
    delete: verb("DELETE"),
    patch: verb("PATCH"),
    head: verb("HEAD"),
    options: verb("OPTIONS"),
    route: ({ method, url }) => {
      collected.push({ source, method: String(method).toUpperCase(), path: url });
    },
    register: noop,
    decorate: noop,
    decorateRequest: noop,
    decorateReply: noop,
    addHook: noop,
    setErrorHandler: noop,
    setNotFoundHandler: noop,
    log: { info: noop, warn: noop, error: noop, debug: noop },
  };
  // chainable register(plugin, opts)
  mock.register = async (plugin, opts) => {
    try {
      if (typeof plugin === "function") await plugin(mock, opts);
    } catch {
      /* swallow nested registration errors */
    }
  };
  return mock;
}

let files;
try {
  files = readdirSync(ROUTES_DIR).filter((f) => /^[0-9]+_.*\.routes\.mjs$/.test(f)).sort();
} catch (e) {
  process.stderr.write(`emit-route-manifest: cannot read ${ROUTES_DIR}: ${e.message}\n`);
  process.exit(1);
}

for (const file of files) {
  const before = collected.length;
  try {
    const url = pathToFileURL(resolve(ROUTES_DIR, file)).href;
    const mod = await import(url);
    const handler = mod.default ?? mod.mount ?? mod.routes;
    const collector = makeCollector(file);
    if (typeof handler === "function") {
      await handler(collector, {});
    } else if (Array.isArray(handler)) {
      for (const r of handler) collector.route(r);
    } else {
      process.stderr.write(`WARN: ${file}: no default/mount/routes export\n`);
    }
  } catch (e) {
    process.stderr.write(`WARN: ${file}: ${e.message}\n`);
  }
  for (const r of collected.slice(before)) {
    process.stdout.write(JSON.stringify({ twin: "fastify", ...r, file }) + "\n");
  }
}
