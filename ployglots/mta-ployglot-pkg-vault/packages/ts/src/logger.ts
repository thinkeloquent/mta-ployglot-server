// @ts-nocheck
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

let currentLevel: LogLevel = LogLevel.DEBUG;

export interface IVaultFileLogger {
  debug(msg: string, ...args: unknown[]): void;
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
}

export class Logger implements IVaultFileLogger {
  private constructor(
    private readonly packageName: string,
    private readonly fileName: string,
  ) {}

  static create(packageName: string, fileName: string): IVaultFileLogger {
    return new Logger(packageName, fileName);
  }

  private prefix(): string {
    return `[${this.packageName}][${this.fileName}]`;
  }

  debug(msg: string, ...args: unknown[]): void {
    if (currentLevel <= LogLevel.DEBUG) console.debug(this.prefix(), msg, ...args);
  }
  info(msg: string, ...args: unknown[]): void {
    if (currentLevel <= LogLevel.INFO) console.info(this.prefix(), msg, ...args);
  }
  warn(msg: string, ...args: unknown[]): void {
    if (currentLevel <= LogLevel.WARN) console.warn(this.prefix(), msg, ...args);
  }
  error(msg: string, ...args: unknown[]): void {
    if (currentLevel <= LogLevel.ERROR) console.error(this.prefix(), msg, ...args);
  }
}

const defaultLogger: IVaultFileLogger = Logger.create('vault-file', 'default');

export function getLogger(): IVaultFileLogger {
  return defaultLogger;
}

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}
