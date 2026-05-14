// @ts-nocheck
import logger from '../logger.js';

const _log = logger.create('@polyglot/fetch-http-client', 'models/url.ts');
void _log;

export type QueryParamValue = string | number | boolean;
export type QueryParams = Record<string, QueryParamValue | QueryParamValue[]>;

export interface URLComponents {
  protocol: string;
  hostname: string;
  port?: number;
  pathname: string;
  search: string;
  hash: string;
  username?: string;
  password?: string;
}

export function joinURL(base: string | URL, path?: string): URL {
  const baseStr = (typeof base === 'string' ? base : base.toString()).replace(/\/+$/, '');
  if (path === undefined || path === '') {
    return new URL(baseStr);
  }
  const trimmed = path.replace(/^\/+/, '');
  return new URL(`${baseStr}/${trimmed}`);
}

export function addParams(url: string | URL, params?: QueryParams): URL {
  const out = url instanceof URL ? new URL(url.toString()) : new URL(url);
  if (!params) return out;
  for (const [key, val] of Object.entries(params)) {
    if (val === undefined || val === null) continue;
    const values = Array.isArray(val) ? val : [val];
    for (const v of values) {
      out.searchParams.append(key, String(v));
    }
  }
  return out;
}

export function buildURL(base?: string | URL, path?: string, params?: QueryParams): URL {
  if (!base && path) {
    return addParams(new URL(path), params);
  }
  if (!base) {
    throw new Error('buildURL: base or absolute path required');
  }
  const joined = joinURL(base, path);
  return addParams(joined, params);
}

export function parseURL(url: string | URL): URLComponents {
  const u = url instanceof URL ? url : new URL(url);
  const out: URLComponents = {
    protocol: u.protocol,
    hostname: u.hostname,
    pathname: u.pathname,
    search: u.search,
    hash: u.hash,
  };
  if (u.port) out.port = parseInt(u.port, 10);
  if (u.username) out.username = u.username;
  if (u.password) out.password = u.password;
  return out;
}

export function matchURLPattern(url: string | URL, pattern: string): boolean {
  const u = url instanceof URL ? url : new URL(url);
  const colonIdx = pattern.indexOf('://');
  if (colonIdx < 0) return false;
  const scheme = pattern.slice(0, colonIdx);
  const rest = pattern.slice(colonIdx + 3);

  const urlScheme = u.protocol.replace(/:$/, '');
  if (scheme !== 'all' && scheme !== urlScheme) return false;

  const slashIdx = rest.indexOf('/');
  const hostPart = slashIdx < 0 ? rest : rest.slice(0, slashIdx);
  const pathPart = slashIdx < 0 ? '' : rest.slice(slashIdx);

  if (hostPart !== '' && hostPart !== '*' && hostPart !== u.hostname) {
    if (hostPart.startsWith('*.')) {
      const suffix = hostPart.slice(2);
      if (!u.hostname.endsWith('.' + suffix) && u.hostname !== suffix) return false;
    } else {
      return false;
    }
  }

  if (pathPart && pathPart !== '/') {
    if (pathPart.endsWith('/*')) {
      const prefix = pathPart.slice(0, -2);
      if (!u.pathname.startsWith(prefix)) return false;
    } else if (u.pathname !== pathPart) {
      return false;
    }
  }

  return true;
}

export function getOrigin(url: string | URL): string {
  const u = url instanceof URL ? url : new URL(url);
  return `${u.protocol}//${u.host}`;
}

export function isValidURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
