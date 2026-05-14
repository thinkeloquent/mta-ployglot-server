import { SecurityError } from './errors.mjs';

const BANNED_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

export class Security {
  static validatePath(path) {
    if (typeof path !== 'string') return;
    for (const part of path.split('.')) {
      if (BANNED_SEGMENTS.has(part)) {
        throw new SecurityError(`Forbidden path segment: ${part}`, { path, part });
      }
    }
  }
}
