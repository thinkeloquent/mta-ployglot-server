export function deepMerge(base, override) {
  const result = structuredClone(base);
  for (const [key, value] of Object.entries(override)) {
    const a = result[key];
    if (
      key in result &&
      a && typeof a === 'object' && !Array.isArray(a) &&
      value && typeof value === 'object' && !Array.isArray(value)
    ) {
      result[key] = deepMerge(a, value);
    } else {
      result[key] = structuredClone(value);
    }
  }
  return result;
}

export function mergeFiles(loaded /* Map<path, parsed> */) {
  let merged = {};
  if (!loaded) return merged;
  for (const parsed of loaded.values()) {
    merged = deepMerge(merged, parsed ?? {});
  }
  return merged;
}

export function mergeGlobalIntoProviders(merged) {
  const result = structuredClone(merged ?? {});
  const g = result.global;
  const ps = result.providers;
  if (!g || typeof g !== 'object' || Object.keys(g).length === 0) return result;
  if (!ps || typeof ps !== 'object' || Object.keys(ps).length === 0) return result;
  for (const [name, p] of Object.entries(ps)) {
    if (p && typeof p === 'object') {
      result.providers[name] = deepMerge(g, p);
    }
  }
  return result;
}
