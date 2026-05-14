// @ts-nocheck
import { pathToFileURL } from "node:url";
import type { Addon } from "../registry/registry.js";
import { createLoaderReport } from "../contract/index.js";
import { createLoaderLogger } from "../registry/loader_logger.js";
import { discoverFiles } from "./_discover.js";

const ROUTE_SUFFIXES = [".routes.mjs", ".routes.js"] as const;

export const routeAddon: Addon = {
  name: "route",
  priority: 30,
  async run(server, config, ctx) {
    const report = createLoaderReport("route");
    const log = createLoaderLogger("route", ctx.logger, report);
    const adapter = ctx.getAdapter();

    for (const dir of config.paths.routes) {
      let result;
      try {
        result = await discoverFiles(dir, ROUTE_SUFFIXES);
      } catch (err) {
        log.failed("discover", dir, err);
        continue;
      }
      log.scanDir(dir, result.matched.length);
      report.discovered += result.matched.length;

      for (const file of result.matched) {
        let mod: { default?: unknown; mount?: unknown };
        try {
          mod = (await import(pathToFileURL(file).href)) as { default?: unknown; mount?: unknown };
          report.imported += 1;
          log.loaded(file);
        } catch (err) {
          log.failed("import", file, err);
          continue;
        }
        const fn = (mod.default ?? mod.mount) as
          | ((s: unknown, c: unknown) => void | Promise<void>)
          | undefined;
        if (typeof fn !== "function") {
          report.skipped += 1;
          log.failed("shape", file, "module has no default or mount function");
          continue;
        }
        try {
          await adapter.registerRoutes(server, fn as never);
          report.registered += 1;
          log.registered(file);
        } catch (err) {
          log.failed("register", file, err);
        }
      }
    }

    return report;
  },
};

export default routeAddon;
