// @ts-nocheck
import type { CacheKeyStrategy } from '../types.js';

export function defaultKeyStrategy(method: string, url: string | URL): string {
  return `${method.toUpperCase()}:${typeof url === 'string' ? url : url.toString()}`;
}

function getByPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return cur;
}

export function createDotNotationKeyStrategy(paths: string[]): CacheKeyStrategy {
  return (method, url, headers, body, params) => {
    const ctx = { headers: headers ?? {}, body, params };
    const parts: string[] = [defaultKeyStrategy(method, url)];
    for (const path of paths) {
      const v = getByPath(ctx, path);
      parts.push(typeof v === 'string' ? v : JSON.stringify(v ?? null));
    }
    return parts.join('|');
  };
}

export function createHashedKeyStrategy(hashFn: (input: string) => string): CacheKeyStrategy {
  return (method, url, headers, body, params) => {
    const base = defaultKeyStrategy(method, url);
    const ctx = JSON.stringify({
      headers: headers ?? null,
      body: body ?? null,
      params: params ?? null,
    });
    return hashFn(base + ctx);
  };
}

export function combineKeyStrategies(...strategies: CacheKeyStrategy[]): CacheKeyStrategy {
  return (method, url, headers, body, params) =>
    strategies.map((s) => s(method, url, headers, body, params)).join('|');
}
