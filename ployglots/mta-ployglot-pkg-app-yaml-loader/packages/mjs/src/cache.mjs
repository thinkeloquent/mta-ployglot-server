const _store = new Map();

export function cacheGet(absPath) {
  return _store.has(absPath) ? structuredClone(_store.get(absPath)) : undefined;
}

export function cacheSet(absPath, value) {
  _store.set(absPath, structuredClone(value));
}

export function clearCache(absPath) {
  if (absPath === undefined) {
    const n = _store.size;
    _store.clear();
    return n;
  }
  return _store.delete(absPath) ? 1 : 0;
}

// Test-only utility — exposes the underlying size without cloning.
export function _cacheSize() {
  return _store.size;
}
