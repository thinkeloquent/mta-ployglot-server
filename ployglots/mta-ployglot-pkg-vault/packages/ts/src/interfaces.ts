// @ts-nocheck
import type { VaultFile, LoadResult } from './domain.js';
import type { IVaultFileLogger } from './logger.js';

export type { IVaultFileLogger };

export interface IVaultFile {
  header: VaultFile['header'];
  secrets: VaultFile['secrets'];
}

export interface IEnvStore {
  get(key: string, defaultValue?: string): string | undefined;
  getOrThrow(key: string): string;
  isInitialized(): boolean;
  onStartup(envFile: string, logger?: IVaultFileLogger): LoadResult;
}
