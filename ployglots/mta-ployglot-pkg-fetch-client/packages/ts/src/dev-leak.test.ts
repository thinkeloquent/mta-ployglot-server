// @ts-nocheck
import { describe, test, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts') && !entry.endsWith('.d.ts'))
      out.push(p);
  }
  return out;
}

describe('dev-leak regression guard', () => {
  test('no console.* calls in src/', () => {
    const files = walk(__dirname);
    const hits: string[] = [];
    const re = /console\.(log|warn|error|info|debug)\b/;
    for (const f of files) {
      const content = readFileSync(f, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (re.test(line)) hits.push(`${f}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(hits, `Found unscrubbed console calls:\n${hits.join('\n')}`).toHaveLength(0);
  });
});
