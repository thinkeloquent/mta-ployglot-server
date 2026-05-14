// @ts-nocheck
/**
 * Tiny structured logger with token redaction. Matches the shape used
 * elsewhere in the polyglot stack so downstream logs are uniform.
 */

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVEL_RANK: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  silent: 5,
};

export interface Logger {
  trace(msg: string, fields?: Record<string, unknown>): void;
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  setLevel(level: LogLevel): void;
}

export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
  stream?: { write: (chunk: string) => void };
}

/**
 * Mask a Figma token / password so it does not leak into logs.
 * Shows first 4 + last 4 characters.
 */
export function maskToken(token: string | undefined): string {
  if (token === undefined || token.length === 0) return '<empty>';
  if (token.length <= 8) return '***';
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

export function createLogger(options: LoggerOptions = {}): Logger {
  let level: LogLevel = options.level ?? (process.env.LOG_LEVEL as LogLevel) ?? 'info';
  const prefix = options.prefix ?? 'figma-api';
  const stream = options.stream ?? process.stderr;

  const emit = (lvl: LogLevel, msg: string, fields?: Record<string, unknown>) => {
    if (LEVEL_RANK[lvl] < LEVEL_RANK[level]) return;
    const payload = {
      ts: new Date().toISOString(),
      level: lvl,
      logger: prefix,
      msg,
      ...(fields ?? {}),
    };
    stream.write(`${JSON.stringify(payload)}\n`);
  };

  return {
    trace: (m, f) => emit('trace', m, f),
    debug: (m, f) => emit('debug', m, f),
    info: (m, f) => emit('info', m, f),
    warn: (m, f) => emit('warn', m, f),
    error: (m, f) => emit('error', m, f),
    setLevel: (l) => {
      level = l;
    },
  };
}
