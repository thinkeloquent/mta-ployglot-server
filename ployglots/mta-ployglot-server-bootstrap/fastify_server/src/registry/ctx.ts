// @ts-nocheck
import type {
  HookCollector,
  HookFn,
  LoaderReport,
  ResolvedBootstrapConfig,
} from "../contract/index.js";
import { createLoaderReport } from "../contract/index.js";
import type { RuntimeAdapter } from "../adapters/adapter.js";

export interface RuntimeContext<Server = unknown> {
  registerInitHook(fn: HookFn<Server>): void;
  registerStartupHook(fn: HookFn<Server>): void;
  registerShutdownHook(fn: HookFn<Server>): void;
  getAdapter(): RuntimeAdapter<Server>;
  getConfig(): ResolvedBootstrapConfig;
  createReport(name: string): LoaderReport;
  logger: Logger;
}

export interface Logger {
  info(msg: string, ...meta: unknown[]): void;
  warn(msg: string, ...meta: unknown[]): void;
  error(msg: string, ...meta: unknown[]): void;
  debug(msg: string, ...meta: unknown[]): void;
}

export const consoleLogger: Logger = {
  info: (m, ...x) => console.log("[polyglot]", m, ...x),
  warn: (m, ...x) => console.warn("[polyglot]", m, ...x),
  error: (m, ...x) => console.error("[polyglot]", m, ...x),
  debug: (m, ...x) => {
    if (process.env.POLYGLOT_DEBUG) console.log("[polyglot:debug]", m, ...x);
  },
};

export function createContext<Server>(
  adapter: RuntimeAdapter<Server>,
  config: ResolvedBootstrapConfig,
  hooks: HookCollector<Server>,
  logger: Logger = consoleLogger,
): RuntimeContext<Server> {
  return {
    registerInitHook: (fn) => {
      hooks.init.push(fn);
    },
    registerStartupHook: (fn) => {
      hooks.startup.push(fn);
    },
    registerShutdownHook: (fn) => {
      hooks.shutdown.push(fn);
    },
    getAdapter: () => adapter,
    getConfig: () => config,
    createReport: createLoaderReport,
    logger,
  };
}
