// @ts-nocheck
import { Readable } from 'node:stream';
import { iterBytes } from './bytes.js';

export async function* iterText(
  stream: Readable,
  encoding: string = 'utf-8',
): AsyncGenerator<string> {
  const decoder = new TextDecoder(encoding, { fatal: false });
  for await (const chunk of iterBytes(stream)) {
    const s = decoder.decode(chunk, { stream: true });
    if (s) yield s;
  }
  const tail = decoder.decode();
  if (tail) yield tail;
}

export async function collectText(stream: Readable, encoding: string = 'utf-8'): Promise<string> {
  let out = '';
  for await (const s of iterText(stream, encoding)) out += s;
  return out;
}
