// @ts-nocheck
import type { Dispatcher } from 'undici';
import { matchURLPattern } from '../models/url.js';

interface MountEntry {
  pattern: string;
  dispatcher: Dispatcher;
  specificity: number;
}

function calculateSpecificity(pattern: string): number {
  if (pattern.startsWith('all://')) return 0;

  const colonIdx = pattern.indexOf('://');
  if (colonIdx < 0) return 1;
  const rest = pattern.slice(colonIdx + 3);
  const slashIdx = rest.indexOf('/');
  const host = slashIdx < 0 ? rest : rest.slice(0, slashIdx);
  const path = slashIdx < 0 ? '' : rest.slice(slashIdx);

  if (host === '*' || host.startsWith('*.')) {
    return 10 + path.length;
  }
  if (path === '' || path === '/') return 100;
  return 1000 + path.length;
}

export class MountRouter {
  private _mounts: MountEntry[] = [];

  mount(pattern: string, dispatcher: Dispatcher): this {
    const specificity = calculateSpecificity(pattern);
    const entry: MountEntry = { pattern, dispatcher, specificity };
    let inserted = false;
    for (let i = 0; i < this._mounts.length; i++) {
      if (specificity > this._mounts[i]!.specificity) {
        this._mounts.splice(i, 0, entry);
        inserted = true;
        break;
      }
    }
    if (!inserted) this._mounts.push(entry);
    return this;
  }

  unmount(pattern: string): boolean {
    const idx = this._mounts.findIndex((m) => m.pattern === pattern);
    if (idx < 0) return false;
    this._mounts.splice(idx, 1);
    return true;
  }

  getDispatcher(url: string | URL): Dispatcher | undefined {
    for (const entry of this._mounts) {
      if (matchURLPattern(url, entry.pattern)) return entry.dispatcher;
    }
    return undefined;
  }

  hasDispatcher(url: string | URL): boolean {
    return this.getDispatcher(url) !== undefined;
  }

  get patterns(): string[] {
    return this._mounts.map((m) => m.pattern);
  }

  get size(): number {
    return this._mounts.length;
  }

  async closeAll(): Promise<void> {
    await Promise.all(
      this._mounts.map((m) => (m.dispatcher as { close: () => Promise<void> }).close()),
    );
    this._mounts = [];
  }

  static fromMounts(mounts: Record<string, Dispatcher>): MountRouter {
    const router = new MountRouter();
    for (const [pattern, dispatcher] of Object.entries(mounts)) {
      router.mount(pattern, dispatcher);
    }
    return router;
  }
}

export function createMountRouter(mounts?: Record<string, Dispatcher>): MountRouter {
  if (!mounts) return new MountRouter();
  return MountRouter.fromMounts(mounts);
}
