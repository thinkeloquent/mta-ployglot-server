// @ts-nocheck
/**
 * Structured logger with level gating, redaction, env-driven config, and child contexts.
 * Single source of truth for the package — every other module imports `logger` from here.
 */

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  silent: 5,
};

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  package: string;
  filename: string;
  message: string;
  context?: Record<string, unknown>;
}

export interface LoggerOptions {
  level?: LogLevel;
  transport?: (entry: LogEntry) => void;
  context?: Record<string, unknown>;
  redactKeys?: string[];
}

export interface Logger {
  trace(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  child(context: Record<string, unknown>): Logger;
  setLevel(level: LogLevel): void;
  getLevel(): LogLevel;
}

const DEFAULT_REDACT_KEYS = [
  'password',
  'secret',
  'token',
  'apiKey',
  'api_key',
  'authorization',
  'auth',
  'credential',
  'private',
];

function redactSensitive(
  value: unknown,
  extraKeys: string[] = [],
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value as object)) return '[CIRCULAR]';
  seen.add(value as object);

  const keySet = new Set([...DEFAULT_REDACT_KEYS, ...extraKeys].map((k) => k.toLowerCase()));

  if (Array.isArray(value)) {
    return value.map((v) => redactSensitive(v, extraKeys, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (keySet.has(k.toLowerCase())) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = redactSensitive(v, extraKeys, seen);
    }
  }
  return out;
}

function extractFilename(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}

function getEnvLogLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
  return (raw in LOG_LEVELS ? raw : 'info') as LogLevel;
}

function formatLogEntry(entry: LogEntry): string {
  if (process.env.LOG_FORMAT === 'json') {
    return JSON.stringify(entry);
  }
  const ctx =
    entry.context && Object.keys(entry.context).length > 0
      ? ' ' + JSON.stringify(entry.context)
      : '';
  return `[${entry.timestamp}] [${entry.level}] [${entry.package}:${entry.filename}] ${entry.message}${ctx}`;
}

function defaultTransport(entry: LogEntry): void {
  const out = formatLogEntry(entry);
  if (entry.level === 'error' || entry.level === 'warn') {
    process.stderr.write(out + '\n');
  } else {
    process.stdout.write(out + '\n');
  }
}

function createLoggerInstance(
  packageName: string,
  filename: string,
  options: LoggerOptions = {},
): Logger {
  let level: LogLevel = options.level ?? getEnvLogLevel();
  const transport = options.transport ?? defaultTransport;
  const baseContext = options.context ?? {};
  const redactKeys = options.redactKeys ?? [];

  const emit = (lvl: LogLevel, message: string, ctx?: Record<string, unknown>): void => {
    if (level === 'silent') return;
    if (LOG_LEVELS[lvl] < LOG_LEVELS[level]) return;
    const merged = { ...baseContext, ...ctx };
    const redacted = redactSensitive(merged, redactKeys) as Record<string, unknown>;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: lvl,
      package: packageName,
      filename: extractFilename(filename),
      message,
      context: Object.keys(redacted).length > 0 ? redacted : undefined,
    };
    transport(entry);
  };

  const instance: Logger = {
    trace: (m, c) => emit('trace', m, c),
    debug: (m, c) => emit('debug', m, c),
    info: (m, c) => emit('info', m, c),
    warn: (m, c) => emit('warn', m, c),
    error: (m, c) => emit('error', m, c),
    setLevel(lvl) {
      level = lvl;
    },
    getLevel() {
      return level;
    },
    child(childContext) {
      return createLoggerInstance(packageName, filename, {
        level,
        transport,
        context: { ...baseContext, ...childContext },
        redactKeys,
      });
    },
  };
  return instance;
}

export function create(packageName: string, filename: string, options?: LoggerOptions): Logger {
  return createLoggerInstance(packageName, filename, options);
}

export const logger = {
  create,
  LOG_LEVELS,
  getEnvLogLevel,
};

export default logger;
