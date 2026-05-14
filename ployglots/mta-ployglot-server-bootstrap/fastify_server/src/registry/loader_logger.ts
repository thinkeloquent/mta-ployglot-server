// @ts-nocheck
import type { LoaderReport } from "../contract/index.js";
import { reportError } from "../contract/index.js";
import type { Logger } from "./ctx.js";

export interface LoaderLogger {
  scanDir(dir: string, matched: number): void;
  loaded(path: string): void;
  registered(path: string, kind?: string): void;
  skipped(path: string, reason: string): void;
  failed(step: string, target: string | undefined, err: unknown): void;
}

export function createLoaderLogger(
  addonName: string,
  logger: Logger,
  report: LoaderReport,
): LoaderLogger {
  const tag = `[${addonName}]`;
  return {
    scanDir(dir, matched) {
      logger.debug(`${tag} scan ${dir}: matched=${matched}`);
    },
    loaded(path) {
      logger.debug(`${tag} loaded ${path}`);
    },
    registered(path, kind) {
      logger.debug(`${tag} registered ${path}${kind ? ` (${kind})` : ""}`);
    },
    skipped(path, reason) {
      logger.info(`${tag} skipped ${path}: ${reason}`);
    },
    failed(step, target, err) {
      const msg = err instanceof Error ? err.message : String(err);
      // error() so swallowed addon failures land on stderr (fastify.error.log)
      // instead of looking like ordinary stdout. Pass the raw err so the
      // consoleLogger surfaces stack/cause on a follow-up line.
      logger.error(`${tag} FAIL [${step}]${target ? ` ${target}` : ""}: ${msg}`, err);
      reportError(report, step, err, target);
    },
  };
}
