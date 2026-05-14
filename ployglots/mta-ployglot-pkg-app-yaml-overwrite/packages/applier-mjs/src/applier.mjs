import { deepMergeWithNullReplace } from './deep-merge-null.mjs';
import { defaultResolver } from './default-resolver.mjs';

const SECTION_FROM_CONTEXT = 'overwrite_from_context';
const SECTION_FROM_ENV = 'overwrite_from_env';

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function lookupEnv(envSection) {
  const out = {};
  if (!isPlainObject(envSection)) return out;
  for (const [key, varName] of Object.entries(envSection)) {
    if (typeof varName !== 'string') continue;
    const v = process.env[varName];
    if (v !== undefined) out[key] = v;
  }
  return out;
}

async function walk(node, ctx) {
  if (Array.isArray(node)) {
    const out = [];
    for (const v of node) out.push(await walk(v, ctx));
    return out;
  }
  if (!isPlainObject(node)) return node;

  const result = {};
  for (const key of Object.keys(node)) {
    if (key === SECTION_FROM_CONTEXT || key === SECTION_FROM_ENV) continue;
    result[key] = await walk(node[key], ctx);
  }

  // env section first (matches source order).
  if (isPlainObject(node[SECTION_FROM_ENV])) {
    const envValues = lookupEnv(node[SECTION_FROM_ENV]);
    const merged = deepMergeWithNullReplace(result, envValues);
    Object.keys(result).forEach((k) => delete result[k]);
    Object.assign(result, merged);
    result[SECTION_FROM_ENV] = structuredClone(node[SECTION_FROM_ENV]);
  }

  // context section second.
  if (isPlainObject(node[SECTION_FROM_CONTEXT])) {
    const resolved = await ctx.resolver.resolveObject(
      node[SECTION_FROM_CONTEXT],
      ctx.context,
      ctx.scope,
    );
    const merged = deepMergeWithNullReplace(result, resolved);
    Object.keys(result).forEach((k) => delete result[k]);
    Object.assign(result, merged);
    result[SECTION_FROM_CONTEXT] = resolved;
  }

  return result;
}

export async function applyOverwritesFromContext(config, options = {}) {
  const resolver = options.resolver ?? (await defaultResolver());
  const ctx = {
    resolver,
    context: options.context ?? {},
    scope: options.scope,
  };
  return walk(config, ctx);
}
