// @ts-nocheck
import fs from 'node:fs';
import path from 'node:path';
import type { LoadResult } from './domain.js';
import type { IVaultFileLogger } from './logger.js';
import { Logger } from './logger.js';
import { parseEnvFile } from './core.js';
import { EnvKeyNotFoundError } from './validators.js';

export class EnvStore {
  static #instance: EnvStore | undefined;

  #store: Record<string, string> = {};
  #initialized = false;
  #totalVarsLoaded = 0;
  #logger: IVaultFileLogger = Logger.create('vault-file', 'env-store');

  private constructor() {}

  static getInstance(): EnvStore {
    if (!EnvStore.#instance) {
      EnvStore.#instance = new EnvStore();
    }
    return EnvStore.#instance;
  }

  /** Internal accessor for VaultFileSDK.describeConfig / diagnoseEnvStore. */
  static _getTotalVarsLoaded(): number {
    return EnvStore.getInstance().#totalVarsLoaded;
  }

  /** Test-only hook — resets the singleton so tests start from a clean store. */
  static _resetForTests(): void {
    EnvStore.#instance = undefined;
  }

  static onStartup(envFile: string, logger?: IVaultFileLogger): LoadResult {
    const instance = EnvStore.getInstance();
    if (logger) instance.#logger = logger;
    if (!envFile) throw new Error('Environment file path is required');

    instance.#initialized = true;

    if (fs.existsSync(envFile)) {
      try {
        const parsed = parseEnvFile(envFile);
        for (const [k, v] of Object.entries(parsed)) {
          instance.#store[k] = v;
        }
      } catch (err) {
        instance.#logger.error(`Failed to parse env file: ${(err as Error).message}`);
        throw err;
      }
    } else {
      instance.#logger.warn(`Env file not found: ${path.resolve(envFile)}`);
    }

    instance.#totalVarsLoaded =
      Object.keys(process.env).length + Object.keys(instance.#store).length;

    return { totalVarsLoaded: instance.#totalVarsLoaded };
  }

  static onStartupAsync(envFile: string, logger?: IVaultFileLogger): Promise<LoadResult> {
    return Promise.resolve(EnvStore.onStartup(envFile, logger));
  }

  static get(key: string, defaultValue?: string): string | undefined {
    // Priority: Internal Store > process.env > default.
    // (vault-wins — deliberate departure from surveyed mjs source which had
    // process.env → store order. See plan README canonical decisions.)
    const instance = EnvStore.getInstance();
    if (Object.prototype.hasOwnProperty.call(instance.#store, key)) {
      return instance.#store[key];
    }
    const envVal = process.env[key];
    if (envVal !== undefined) return envVal;
    return defaultValue;
  }

  static getOrThrow(key: string): string {
    if (!key) throw new Error('Key is required');
    const value = EnvStore.get(key);
    if (value === undefined) {
      throw new EnvKeyNotFoundError(key);
    }
    return value;
  }

  static isInitialized(): boolean {
    const inst = EnvStore.#instance;
    return inst ? inst.#initialized : false;
  }
}
