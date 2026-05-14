function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export function deepMergeWithNullReplace(base, override) {
  const result = structuredClone(base ?? {});
  if (!isPlainObject(override)) return result;
  for (const [key, value] of Object.entries(override)) {
    if (value === null) {
      delete result[key];
      continue;
    }
    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = deepMergeWithNullReplace(result[key], value);
    } else {
      result[key] = structuredClone(value);
    }
  }
  return result;
}
