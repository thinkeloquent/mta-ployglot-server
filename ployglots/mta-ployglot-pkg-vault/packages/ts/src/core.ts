// @ts-nocheck
import fs from 'node:fs';
import { VaultFile, VaultFileSchema } from './domain.js';
import { Logger, IVaultFileLogger } from './logger.js';

const log: IVaultFileLogger = Logger.create('vault-file', 'core');

function toSnakeCase(s: string): string {
  return s.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
}

function toCamelCase(s: string): string {
  return s.replace(/_([a-z])/g, (_m, c) => c.toUpperCase());
}

function transformKeys(
  obj: unknown,
  transformer: (s: string) => string,
): unknown {
  if (Array.isArray(obj)) return obj.map((v) => transformKeys(v, transformer));
  if (obj !== null && typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[transformer(k)] = transformKeys(v, transformer);
    }
    return out;
  }
  return obj;
}

export function normalizeVersion(version: string): string {
  const parts = version.split('.');
  while (parts.length < 3) parts.push('0');
  return parts.slice(0, 3).join('.');
}

export function toJSON(vaultFile: VaultFile): string {
  const snake = transformKeys(vaultFile, toSnakeCase);
  return JSON.stringify(snake, null, 2);
}

export function fromJSON(jsonStr: string): VaultFile {
  if (typeof jsonStr !== 'string' || jsonStr.length === 0) {
    throw new Error('Invalid JSON input: input is empty or not a string');
  }
  const raw = JSON.parse(jsonStr);
  const camel = transformKeys(raw, toCamelCase) as Record<string, unknown>;
  if (camel && typeof camel === 'object' && 'header' in camel) {
    const header = camel.header as Record<string, unknown>;
    if ('version' in header && typeof header.version === 'string') {
      header.version = normalizeVersion(header.version);
    }
  }
  return VaultFileSchema.parse(camel);
}

export function parseEnvFile(filePath: string): Record<string, string> {
  if (!filePath) throw new Error('File path is required');
  if (!fs.existsSync(filePath)) return {};

  const contents = fs.readFileSync(filePath, 'utf8');
  const out: Record<string, string> = {};
  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) {
      log.warn(`line without '=' skipped: ${line}`);
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}
