import * as path from 'node:path';

const DEFAULT_BASE_FILES = Object.freeze([
  'base.yml',
  'security.yml',
  'api-release-date.yml',
  'feature_flags.yml',
]);

const DEFAULT_ENV_SUFFIXES = Object.freeze(['server', 'endpoint']);

export function resolveConfigDir(override, callerDir) {
  if (override !== undefined && override !== null) {
    if (override === '') throw new Error('configDir must not be an empty string');
    return override;
  }
  const envVal = process.env.CONFIG_DIR;
  if (envVal !== undefined) {
    if (envVal === '') throw new Error('CONFIG_DIR env var must not be an empty string');
    return envVal;
  }
  if (callerDir) return path.join(callerDir, '..', '..', '..', '..', 'common', 'config');
  throw new Error('configDir is required: pass it explicitly, set CONFIG_DIR env var, or provide callerDir');
}

export function resolveAppEnv(override) {
  return (override || process.env.APP_ENV || 'dev').toLowerCase();
}

export function buildConfigFiles(
  configDir,
  appEnv,
  baseFiles = DEFAULT_BASE_FILES,
  envSuffixes = DEFAULT_ENV_SUFFIXES,
) {
  return [
    ...baseFiles.map((f) => path.join(configDir, f)),
    ...envSuffixes.map((prefix) => path.join(configDir, `${prefix}.${appEnv}.yaml`)),
  ];
}
