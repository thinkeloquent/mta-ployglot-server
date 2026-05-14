// @ts-nocheck
export type StringOrArray = string | string[];

export interface BootstrapPaths {
  environment?: StringOrArray;
  lifecycles?: StringOrArray;
  routes?: StringOrArray;
  apps?: StringOrArray;
}

export interface LoggerConfig {
  level?: "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "silent";
  json_format?: boolean;
  [k: string]: unknown;
}

export interface BootstrapConfig {
  title?: string;
  port?: number;
  host?: string;
  profile?: string;
  logger?: LoggerConfig;
  paths?: BootstrapPaths;
  initial_state?: Record<string, unknown>;
  [k: string]: unknown;
}

export interface ResolvedPaths {
  environment: string[];
  lifecycles: string[];
  routes: string[];
  apps: string[];
}

export interface ResolvedBootstrapConfig extends BootstrapConfig {
  title: string;
  port: number;
  host: string;
  paths: ResolvedPaths;
  initial_state: Record<string, unknown>;
}

export interface LoaderReportError {
  step: string;
  error: string;
  path?: string;
  [k: string]: unknown;
}

export interface LoaderReport {
  name: string;
  discovered: number;
  validated: number;
  imported: number;
  registered: number;
  skipped: number;
  errors: LoaderReportError[];
  details?: Record<string, unknown>;
}

export type LoaderReports = Record<string, LoaderReport>;

export type HookFn<Server = unknown> = (
  server: Server,
  config: ResolvedBootstrapConfig,
) => void | Promise<void>;

export interface HookCollector<Server = unknown> {
  init: HookFn<Server>[];
  startup: HookFn<Server>[];
  shutdown: HookFn<Server>[];
}
