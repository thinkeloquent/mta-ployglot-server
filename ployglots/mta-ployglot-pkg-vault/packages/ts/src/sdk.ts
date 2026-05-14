// @ts-nocheck
import type { IVaultFileLogger } from './logger.js';
import { Logger } from './logger.js';
import type {
  SDKResult,
  ConfigDescription,
  SecretInfo,
  ValidationResult,
  DiagnosticResult,
  IVaultFileSDK,
} from './sdk-types.js';
import { makeSDKError } from './sdk-types.js';
import type { LoadResult } from './domain.js';
import { EnvStore } from './env-store.js';
import { parseEnvFile } from './core.js';

export class VaultFileSDK implements IVaultFileSDK {
  private envPath: string | undefined;
  private base64Parsers: Record<string, (s: string) => string> = {};
  private logger: IVaultFileLogger;

  private constructor(logger?: IVaultFileLogger) {
    this.logger = logger ?? Logger.create('vault-file', 'sdk');
  }

  static create(): VaultFileSDKBuilder {
    return new VaultFileSDKBuilder();
  }

  /** Internal factory used by VaultFileSDKBuilder.build(). Not public. */
  static newForBuilder(): VaultFileSDK {
    return new VaultFileSDK();
  }

  setEnvPath(path: string): void {
    this.envPath = path;
  }
  setBase64Parsers(parsers: Record<string, (s: string) => string>): void {
    this.base64Parsers = parsers;
  }
  setLogger(logger: IVaultFileLogger): void {
    this.logger = logger;
  }

  protected success<T>(data: T): SDKResult<T> {
    return { success: true, data };
  }
  protected failure<T>(
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ): SDKResult<T> {
    return { success: false, error: makeSDKError(code, message, details) };
  }

  loadConfig(): SDKResult<LoadResult> {
    try {
      const result = EnvStore.onStartup(this.envPath ?? '.env', this.logger);
      return this.success(result);
    } catch (err) {
      return this.failure('LOAD_FAILED', (err as Error).message, { envPath: this.envPath });
    }
  }

  loadFromPath(filePath: string): SDKResult<LoadResult> {
    try {
      const result = EnvStore.onStartup(filePath, this.logger);
      return this.success(result);
    } catch (err) {
      return this.failure('LOAD_FAILED', (err as Error).message, { filePath });
    }
  }

  validateFile(filePath: string): SDKResult<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    try {
      const parsed = parseEnvFile(filePath);
      if (Object.keys(parsed).length === 0) warnings.push('file parsed to empty map');
      return this.success({ valid: errors.length === 0, errors, warnings });
    } catch (err) {
      errors.push((err as Error).message);
      return this.success({ valid: false, errors, warnings });
    }
  }

  /**
   * @stub Not yet implemented. Returns SDKResult with error.code 'NOT_IMPLEMENTED'.
   * Declared on IVaultFileSDK so consumers can program against the final shape.
   */
  exportToFormat(_format: 'json' | 'yaml', _path: string): SDKResult<void> {
    return this.failure('NOT_IMPLEMENTED', 'exportToFormat is a stub');
  }

  describeConfig(): SDKResult<ConfigDescription> {
    const varsCount = EnvStore._getTotalVarsLoaded();
    return this.success({
      version: '1.0.0',
      varsCount,
      source: this.envPath ?? '.env',
    });
  }

  getSecretSafe(key: string): SDKResult<SecretInfo> {
    const value = EnvStore.get(key);
    if (value === undefined) {
      return this.failure('KEY_NOT_FOUND', `key '${key}' not present`);
    }
    return this.success({ key, masked: '***', exists: true });
  }

  /** @stub Returns an empty list. */
  listAvailableKeys(): SDKResult<string[]> {
    return this.success([]);
  }

  diagnoseEnvStore(): SDKResult<DiagnosticResult> {
    return this.success({
      initialized: EnvStore.isInitialized(),
      varsLoaded: EnvStore._getTotalVarsLoaded(),
      source: this.envPath,
    });
  }

  findMissingRequired(keys: string[]): SDKResult<string[]> {
    const missing = keys.filter((k) => EnvStore.get(k) === undefined);
    return this.success(missing);
  }

  /** @stub Returns an empty list. */
  suggestMissingKeys(_partial: string): SDKResult<string[]> {
    return this.success([]);
  }
}

export class VaultFileSDKBuilder {
  private envPath: string | undefined;
  private base64Parsers: Record<string, (s: string) => string> = {};
  private logger: IVaultFileLogger | undefined;

  withEnvPath(path: string): VaultFileSDKBuilder {
    this.envPath = path;
    return this;
  }

  withBase64Parsers(parsers: Record<string, (s: string) => string>): VaultFileSDKBuilder {
    this.base64Parsers = parsers;
    return this;
  }

  withLogger(logger: IVaultFileLogger): VaultFileSDKBuilder {
    this.logger = logger;
    return this;
  }

  build(): VaultFileSDK {
    const sdk = VaultFileSDK.newForBuilder();
    if (this.envPath !== undefined) sdk.setEnvPath(this.envPath);
    sdk.setBase64Parsers(this.base64Parsers);
    sdk.setLogger(this.logger ?? Logger.create('vault-file', 'sdk'));
    return sdk;
  }
}
