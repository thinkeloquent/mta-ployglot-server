// @ts-nocheck
import type { LoaderReport, LoaderReports, ResolvedBootstrapConfig } from "../contract/index.js";
import { createLoaderReport, reportError } from "../contract/index.js";
import type { RuntimeContext } from "./ctx.js";

export interface Addon<Server = unknown> {
  name: string;
  priority: number;
  run: (
    server: Server,
    config: ResolvedBootstrapConfig,
    ctx: RuntimeContext<Server>,
  ) => LoaderReport | Promise<LoaderReport>;
}

interface RegistryEntry<Server> {
  addon: Addon<Server>;
  insertionIndex: number;
}

export class Registry<Server = unknown> {
  private entries: RegistryEntry<Server>[] = [];
  private counter = 0;

  register(addon: Addon<Server>): this {
    if (!addon || typeof addon.name !== "string" || typeof addon.run !== "function") {
      throw new TypeError("Addon must be { name: string, priority: number, run: function }");
    }
    this.entries.push({ addon, insertionIndex: this.counter++ });
    return this;
  }

  list(): Addon<Server>[] {
    return [...this.entries]
      .sort((a, b) => {
        if (a.addon.priority !== b.addon.priority) return a.addon.priority - b.addon.priority;
        return a.insertionIndex - b.insertionIndex;
      })
      .map((e) => e.addon);
  }

  async runAll(
    server: Server,
    config: ResolvedBootstrapConfig,
    ctx: RuntimeContext<Server>,
  ): Promise<LoaderReports> {
    const reports: LoaderReports = {};
    for (const addon of this.list()) {
      try {
        const report = await addon.run(server, config, ctx);
        reports[addon.name] = report;
      } catch (err) {
        const fallback = createLoaderReport(addon.name);
        reportError(fallback, "run", err);
        reports[addon.name] = fallback;
      }
    }
    return reports;
  }
}

export function composeAddons<S>(...groups: (Addon<S>[] | Addon<S>)[]): Addon<S>[] {
  const out: Addon<S>[] = [];
  for (const g of groups) {
    if (Array.isArray(g)) out.push(...g);
    else out.push(g);
  }
  return out;
}
