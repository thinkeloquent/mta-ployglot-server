// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { Readable } from 'node:stream';
import { iterBytes, collectBytes, createProgressStream } from './bytes.js';
import { iterText, collectText } from './text.js';
import { iterLines, iterNDJSON, collectLines, iterSSE } from './lines.js';

function makeStream(chunks: string[]): Readable {
  return Readable.from(chunks.map((c) => Buffer.from(c)));
}

describe('iterBytes', () => {
  it('passes chunks through when chunkSize is unset', async () => {
    const out: Buffer[] = [];
    for await (const c of iterBytes(makeStream(['ab', 'cd']))) out.push(c);
    expect(Buffer.concat(out).toString()).toBe('abcd');
  });

  it('rechunks to fixed size', async () => {
    const out: Buffer[] = [];
    for await (const c of iterBytes(makeStream(['abcde']), 2)) out.push(c);
    expect(out.map((b) => b.toString())).toEqual(['ab', 'cd', 'e']);
  });
});

describe('collectBytes', () => {
  it('drains everything into one Buffer', async () => {
    const buf = await collectBytes(makeStream(['hi']));
    expect(buf.toString()).toBe('hi');
  });
});

describe('createProgressStream', () => {
  it('reports cumulative bytes per feed call', async () => {
    const calls: Array<[number, number | undefined]> = [];
    const handle = createProgressStream((b, t) => calls.push([b, t]), 10);
    handle.feed(Buffer.from('xx'));
    handle.feed(Buffer.from('yyy'));
    handle.end();
    expect(calls).toEqual([
      [2, 10],
      [5, 10],
    ]);
    const collected = await collectBytes(handle.stream);
    expect(collected.toString()).toBe('xxyyy');
  });
});

describe('iterText / collectText', () => {
  it('decodes utf-8 by default', async () => {
    expect(await collectText(makeStream(['hi']))).toBe('hi');
  });

  it('handles multi-byte char split across chunks', async () => {
    const heart = Buffer.from('❤');
    const a = heart.subarray(0, 1);
    const b = heart.subarray(1);
    const split = Readable.from([a, b]);
    expect(await collectText(split)).toBe('❤');
  });
});

describe('iterLines / collectLines', () => {
  it('splits on \\n, strips trailing \\r', async () => {
    const lines = await collectLines(makeStream(['a\r\nb\nc']));
    expect(lines).toEqual(['a', 'b', 'c']);
  });

  it('emits across chunk boundaries', async () => {
    const out: string[] = [];
    for await (const l of iterLines(makeStream(['he', 'llo\nwor', 'ld\n']))) out.push(l);
    expect(out).toEqual(['hello', 'world']);
  });

  it('empty stream → no output', async () => {
    const out = await collectLines(makeStream([]));
    expect(out).toEqual([]);
  });
});

describe('iterNDJSON', () => {
  it('parses each newline-delimited JSON object', async () => {
    const out: unknown[] = [];
    for await (const obj of iterNDJSON(makeStream(['{"a":1}\n{"b":2}\n']))) out.push(obj);
    expect(out).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('skips invalid lines without throwing', async () => {
    const out: unknown[] = [];
    for await (const obj of iterNDJSON(makeStream(['{"ok":1}\nNOT-JSON\n{"ok":2}\n'])))
      out.push(obj);
    expect(out).toEqual([{ ok: 1 }, { ok: 2 }]);
  });
});

describe('iterSSE', () => {
  it('emits a simple event', async () => {
    const out: unknown[] = [];
    for await (const e of iterSSE(makeStream(['data: hello\n\n']))) out.push(e);
    expect(out).toEqual([{ data: 'hello' }]);
  });

  it('emits event with type', async () => {
    const out: unknown[] = [];
    for await (const e of iterSSE(makeStream(['event: msg\ndata: hi\n\n']))) out.push(e);
    expect(out).toEqual([{ event: 'msg', data: 'hi' }]);
  });

  it('joins multi-line data with \\n', async () => {
    const out: unknown[] = [];
    for await (const e of iterSSE(makeStream(['data: a\ndata: b\n\n']))) out.push(e);
    expect(out).toEqual([{ data: 'a\nb' }]);
  });

  it('skips comment lines (starting with :)', async () => {
    const out: unknown[] = [];
    for await (const e of iterSSE(makeStream([': comment\ndata: ok\n\n']))) out.push(e);
    expect(out).toEqual([{ data: 'ok' }]);
  });

  it('parses retry as integer; non-numeric ignored', async () => {
    const a: unknown[] = [];
    for await (const e of iterSSE(makeStream(['retry: 1500\ndata: x\n\n']))) a.push(e);
    expect(a).toEqual([{ data: 'x', retry: 1500 }]);

    const b: unknown[] = [];
    for await (const e of iterSSE(makeStream(['retry: bad\ndata: x\n\n']))) b.push(e);
    expect(b).toEqual([{ data: 'x' }]);
  });

  it('blank line without data does not emit', async () => {
    const out: unknown[] = [];
    for await (const e of iterSSE(makeStream(['event: empty\n\n']))) out.push(e);
    expect(out).toEqual([]);
  });
});
