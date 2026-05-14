// @ts-nocheck
import logger from '../logger.js';

const _log = logger.create('@polyglot/fetch-http-client', 'models/headers.ts');
void _log;

export type HeadersInit = string | string[][] | Record<string, string | string[]> | Headers;

export class Headers {
  private _data: Map<string, string[]> = new Map();
  private _caseMap: Map<string, string> = new Map(); // lower → original

  constructor(init?: HeadersInit) {
    if (!init) return;
    if (init instanceof Headers) {
      for (const [k, vs] of init._data.entries()) {
        this._data.set(k, [...vs]);
        this._caseMap.set(k, init._caseMap.get(k) ?? k);
      }
      return;
    }
    if (typeof init === 'string') {
      for (const line of init.split(/\r?\n/)) {
        const idx = line.indexOf(':');
        if (idx < 0) continue;
        this.append(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
      }
      return;
    }
    if (Array.isArray(init)) {
      for (const pair of init) {
        const [k, v] = pair;
        if (typeof k === 'string' && typeof v === 'string') this.append(k, v);
      }
      return;
    }
    for (const [k, v] of Object.entries(init)) {
      if (Array.isArray(v)) for (const vv of v) this.append(k, vv);
      else this.append(k, v);
    }
  }

  private _key(name: string): string {
    return name.toLowerCase();
  }

  get(name: string): string | undefined {
    const k = this._key(name);
    const vs = this._data.get(k);
    return vs && vs.length > 0 ? vs[0] : undefined;
  }

  getAll(name: string): string[] {
    return this._data.get(this._key(name))?.slice() ?? [];
  }

  set(name: string, value: string): void {
    const k = this._key(name);
    this._data.set(k, [value]);
    this._caseMap.set(k, name);
  }

  append(name: string, value: string): void {
    const k = this._key(name);
    const existing = this._data.get(k);
    if (existing) existing.push(value);
    else {
      this._data.set(k, [value]);
      this._caseMap.set(k, name);
    }
  }

  has(name: string): boolean {
    return this._data.has(this._key(name));
  }

  delete(name: string): void {
    const k = this._key(name);
    this._data.delete(k);
    this._caseMap.delete(k);
  }

  get size(): number {
    return this._data.size;
  }

  *entries(): IterableIterator<[string, string]> {
    for (const [k, vs] of this._data.entries()) {
      const original = this._caseMap.get(k) ?? k;
      for (const v of vs) yield [original, v];
    }
  }

  *keys(): IterableIterator<string> {
    for (const [k] of this._data.entries()) {
      yield this._caseMap.get(k) ?? k;
    }
  }

  *values(): IterableIterator<string> {
    for (const [, vs] of this._data.entries()) {
      for (const v of vs) yield v;
    }
  }

  forEach(cb: (value: string, key: string, parent: Headers) => void, thisArg?: unknown): void {
    for (const [k, v] of this.entries()) {
      cb.call(thisArg, v, k, this);
    }
  }

  [Symbol.iterator](): IterableIterator<[string, string]> {
    return this.entries();
  }

  toJSON(): Record<string, string | string[]> {
    const out: Record<string, string | string[]> = {};
    for (const [k, vs] of this._data.entries()) {
      const original = this._caseMap.get(k) ?? k;
      out[original] = vs.length === 1 ? vs[0]! : vs.slice();
    }
    return out;
  }

  toObject(): Record<string, string | string[]> {
    return this.toJSON();
  }

  toUndiciHeaders(): Record<string, string | string[]> {
    return this.toJSON();
  }

  clone(): Headers {
    const next = new Headers();
    for (const [k, vs] of this._data.entries()) {
      next._data.set(k, [...vs]);
      next._caseMap.set(k, this._caseMap.get(k) ?? k);
    }
    return next;
  }

  merge(other: Headers | HeadersInit): Headers {
    const result = this.clone();
    const otherH = other instanceof Headers ? other : new Headers(other);
    for (const [k, vs] of otherH._data.entries()) {
      result._data.set(k, [...vs]);
      result._caseMap.set(k, otherH._caseMap.get(k) ?? k);
    }
    return result;
  }

  toString(): string {
    const lines: string[] = [];
    for (const [k, v] of this.entries()) lines.push(`${k}: ${v}`);
    return lines.join('\n');
  }
}

export function createHeaders(input?: HeadersInit | Headers): Headers {
  if (input instanceof Headers) return input;
  return new Headers(input);
}
