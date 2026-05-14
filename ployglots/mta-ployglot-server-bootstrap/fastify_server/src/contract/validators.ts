// @ts-nocheck
import type {
  BootstrapConfig,
  LoaderReport,
  LoaderReportError,
  ResolvedBootstrapConfig,
  ResolvedPaths,
  StringOrArray,
} from "./types.js";
import { resolve, isAbsolute } from "node:path";

const PATH_KEYS: (keyof ResolvedPaths)[] = ["environment", "lifecycles", "routes", "apps"];

export class BootstrapConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BootstrapConfigError";
  }
}

export function validateBootstrapConfig(config: unknown): BootstrapConfig {
  if (config === null || typeof config !== "object") {
    throw new BootstrapConfigError("BootstrapConfig must be an object");
  }
  const c = config as Record<string, unknown>;
  if (c.port !== undefined) {
    const p = c.port;
    if (typeof p !== "number" || !Number.isInteger(p) || p < 0 || p > 65535) {
      throw new BootstrapConfigError(`port must be an integer in [0, 65535], got ${String(p)}`);
    }
  }
  if (c.title !== undefined && typeof c.title !== "string") {
    throw new BootstrapConfigError("title must be a string");
  }
  if (c.host !== undefined && typeof c.host !== "string") {
    throw new BootstrapConfigError("host must be a string");
  }
  if (c.paths !== undefined) {
    if (c.paths === null || typeof c.paths !== "object") {
      throw new BootstrapConfigError("paths must be an object");
    }
    for (const key of Object.keys(c.paths as object)) {
      if (!PATH_KEYS.includes(key as keyof ResolvedPaths)) {
        throw new BootstrapConfigError(`unknown paths key: ${key}`);
      }
    }
  }
  return c as BootstrapConfig;
}

function toArray(v: StringOrArray | undefined): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? [...v] : [v];
}

export function resolvePaths(
  paths: BootstrapConfig["paths"] | undefined,
  baseDir: string,
): ResolvedPaths {
  const source = paths ?? {};
  const out: ResolvedPaths = { environment: [], lifecycles: [], routes: [], apps: [] };
  for (const key of PATH_KEYS) {
    out[key] = toArray(source[key]).map((p) => (isAbsolute(p) ? p : resolve(baseDir, p)));
  }
  return out;
}

export function mergeConfig(
  defaults: BootstrapConfig,
  user: BootstrapConfig,
  baseDir: string,
): ResolvedBootstrapConfig {
  validateBootstrapConfig(defaults);
  validateBootstrapConfig(user);

  const mergedPathsSource: BootstrapConfig["paths"] = {};
  for (const key of PATH_KEYS) {
    const d = toArray(defaults.paths?.[key]);
    const u = toArray(user.paths?.[key]);
    mergedPathsSource[key] = [...d, ...u];
  }

  const resolvedPaths = resolvePaths(mergedPathsSource, baseDir);

  return {
    ...defaults,
    ...user,
    title: user.title ?? defaults.title ?? "polyglot-server",
    port: user.port ?? defaults.port ?? 3000,
    host: user.host ?? defaults.host ?? "0.0.0.0",
    logger: { ...(defaults.logger ?? {}), ...(user.logger ?? {}) },
    paths: resolvedPaths,
    initial_state: { ...(defaults.initial_state ?? {}), ...(user.initial_state ?? {}) },
  };
}

export function createLoaderReport(name: string): LoaderReport {
  return {
    name,
    discovered: 0,
    validated: 0,
    imported: 0,
    registered: 0,
    skipped: 0,
    errors: [],
  };
}

export function reportError(
  report: LoaderReport,
  step: string,
  err: unknown,
  path?: string,
): void {
  const entry: LoaderReportError = {
    step,
    error: err instanceof Error ? err.message : String(err),
  };
  if (path !== undefined) entry.path = path;
  report.errors.push(entry);
}

/**
 * Sort file paths by numeric prefix (e.g. "01_foo", "10-bar"), fallback to lexical.
 * Matches the platform-core loader convention.
 */
export function sortByNumericPrefix(paths: string[]): string[] {
  const extract = (p: string): [number, string] => {
    const base = p.split("/").pop() ?? p;
    const m = /^(\d+)[_-]/.exec(base);
    return m ? [parseInt(m[1]!, 10), base] : [Number.MAX_SAFE_INTEGER, base];
  };
  return [...paths].sort((a, b) => {
    const [an, as] = extract(a);
    const [bn, bs] = extract(b);
    if (an !== bn) return an - bn;
    return as.localeCompare(bs);
  });
}
