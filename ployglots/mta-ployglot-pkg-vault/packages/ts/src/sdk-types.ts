// @ts-nocheck
import type { LoadResult, VaultFile } from './domain.js';

export interface SDKInfo {
  name: string;
  version: string;
  description?: string;
}

export interface SDKError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export function makeSDKError(
  code: string,
  message: string,
  details?: Record<string, unknown>,
): SDKError {
  return { code, message, details };
}

export interface SDKResult<T> {
  success: boolean;
  data?: T;
  error?: SDKError;
}

export interface ConfigDescription {
  version: string;
  varsCount: number;
  source: string;
}

export interface SecretInfo {
  key: string;
  masked: string;
  exists: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface DiagnosticResult {
  initialized: boolean;
  varsLoaded: number;
  source?: string;
}

export interface IVaultFileSDK {
  loadConfig(): SDKResult<LoadResult>;
  loadFromPath(path: string): SDKResult<LoadResult>;
  validateFile(path: string): SDKResult<ValidationResult>;
  exportToFormat(format: 'json' | 'yaml', path: string): SDKResult<void>;
  describeConfig(): SDKResult<ConfigDescription>;
  getSecretSafe(key: string): SDKResult<SecretInfo>;
  listAvailableKeys(): SDKResult<string[]>;
  diagnoseEnvStore(): SDKResult<DiagnosticResult>;
  findMissingRequired(keys: string[]): SDKResult<string[]>;
  suggestMissingKeys(partial: string): SDKResult<string[]>;
}

export type { VaultFile };
