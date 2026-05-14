import * as path from 'node:path';
import yaml from 'js-yaml';
import { io } from './_io.mjs';
import { LoadError } from './errors.mjs';
import { resolveConfigDir, resolveAppEnv, buildConfigFiles } from './paths.mjs';
import { cacheGet, cacheSet } from './cache.mjs';

const VALID_MISSING = new Set(['raise', 'skip']);

export async function loadFiles(paths, { missing = 'raise', force = false, logger } = {}) {
  if (!VALID_MISSING.has(missing)) {
    throw new Error(`Invalid missing strategy: ${missing}`);
  }

  const out = new Map();

  for (const p of paths) {
    if (typeof p !== 'string') {
      throw new TypeError(`paths[*] must be string, got ${typeof p}`);
    }
    const abs = path.resolve(p);

    if (!force) {
      const hit = cacheGet(abs);
      if (hit !== undefined) {
        out.set(abs, hit);
        continue;
      }
    }

    let raw;
    try {
      raw = await io.readFile(abs, 'utf8');
    } catch (e) {
      if (e && e.code === 'ENOENT' && missing === 'skip') {
        if (logger && typeof logger.warn === 'function') {
          logger.warn(`app-yaml-loader: skipping missing file ${abs}`);
        }
        continue;
      }
      throw new LoadError(`Failed to read ${abs}`, { path: abs, cause: e });
    }

    let parsed;
    try {
      parsed = yaml.load(raw) ?? {};
    } catch (e) {
      throw new LoadError(`Failed to parse ${abs}`, { path: abs, cause: e });
    }

    cacheSet(abs, parsed);
    // cacheGet returns a fresh clone; use it so the caller's map mirrors cache semantics.
    out.set(abs, cacheGet(abs));
  }

  return out;
}

export async function loadFromConfigDir(opts = {}) {
  const configDir = resolveConfigDir(opts.configDir, opts.callerDir);
  const appEnv = resolveAppEnv(opts.appEnv);
  const files = buildConfigFiles(configDir, appEnv, opts.baseFiles, opts.envSuffixes);
  return loadFiles(files, { missing: opts.missing, force: opts.force, logger: opts.logger });
}
