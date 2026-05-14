// @ts-nocheck
import type { QueryParams, QueryParamValue } from '../models/url.js';

export function mergeParams(
  existing: QueryParams | undefined,
  next: QueryParams | undefined,
): QueryParams {
  if (!existing) return { ...(next ?? {}) };
  if (!next) return { ...existing };
  const out: QueryParams = { ...existing };
  for (const [k, v] of Object.entries(next)) {
    const cur = out[k];
    if (cur === undefined) {
      out[k] = v;
      continue;
    }
    const curArr = Array.isArray(cur) ? cur : [cur];
    const nextArr = Array.isArray(v) ? v : [v];
    if (Array.isArray(cur) || Array.isArray(v)) {
      out[k] = [...curArr, ...nextArr] as QueryParamValue[];
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function buildURLWithParams(baseURL: string | URL, params?: QueryParams): URL {
  const u = baseURL instanceof URL ? new URL(baseURL.toString()) : new URL(baseURL);
  if (!params) return u;
  for (const [k, v] of Object.entries(params)) {
    const arr = Array.isArray(v) ? v : [v];
    for (const vv of arr) u.searchParams.append(k, String(vv));
  }
  return u;
}

export function parseQueryString(queryString: string): QueryParams {
  const stripped = queryString.startsWith('?') ? queryString.slice(1) : queryString;
  const params = new URLSearchParams(stripped);
  const out: QueryParams = {};
  for (const [k, v] of params.entries()) {
    const cur = out[k];
    if (cur === undefined) {
      out[k] = v;
    } else if (Array.isArray(cur)) {
      cur.push(v);
    } else {
      out[k] = [cur as QueryParamValue, v];
    }
  }
  return out;
}

export function serializeParams(params: QueryParams): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    const arr = Array.isArray(v) ? v : [v];
    for (const vv of arr) sp.append(k, String(vv));
  }
  return sp.toString();
}
