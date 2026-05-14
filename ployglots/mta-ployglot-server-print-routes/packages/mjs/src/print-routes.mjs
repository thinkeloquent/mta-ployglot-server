/**
 * Print registered Fastify routes in a flat table format.
 *
 * Usage:
 *   setupRouteCollector(fastify);   // call BEFORE routes are registered
 *   // ... register routes ...
 *   printRoutes(fastify);           // call AFTER app.ready()
 */

export function setupRouteCollector(fastify) {
  const routeMap = new Map();
  fastify.addHook("onRoute", (routeOptions) => {
    const url = routeOptions.url;
    if (!routeMap.has(url)) {
      routeMap.set(url, new Set());
    }
    const methods = Array.isArray(routeOptions.method)
      ? routeOptions.method
      : [routeOptions.method];
    for (const m of methods) {
      routeMap.get(url).add(m);
    }
  });
  fastify.decorate("_routeMap", routeMap);
}

export function printRoutes(fastify) {
  console.log("Registered Routes - Fastify:");

  const routeMap = fastify._routeMap;
  if (!routeMap || routeMap.size === 0) {
    console.log(fastify.printRoutes({ commonPrefix: false }));
    return;
  }

  const entries = [...routeMap.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  );

  for (const [url, methods] of entries) {
    const methodStr = [...methods].sort().join(", ");
    console.log(`  ${url.padEnd(55)} | ${methodStr}`);
  }
}
