// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { VaultHeaderSchema } from '../src/domain.js';

describe('VaultHeader createdAt precision', () => {
  it('defaults to millisecond precision ISO 8601', () => {
    const h = VaultHeaderSchema.parse({});
    expect(h.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});
