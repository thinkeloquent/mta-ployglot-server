// @ts-nocheck
import { Readable } from 'node:stream';

export async function* iterBytes(stream: Readable, chunkSize?: number): AsyncGenerator<Buffer> {
  if (chunkSize === undefined || chunkSize <= 0) {
    for await (const chunk of stream) {
      yield Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    }
    return;
  }
  let pending = Buffer.alloc(0);
  for await (const chunk of stream) {
    pending = Buffer.concat([pending, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
    while (pending.length >= chunkSize) {
      yield pending.subarray(0, chunkSize);
      pending = pending.subarray(chunkSize);
    }
  }
  if (pending.length > 0) yield pending;
}

export async function collectBytes(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  return Buffer.concat(chunks);
}

export interface ProgressStreamHandle {
  stream: Readable;
  feed: (chunk: Buffer) => void;
  end: () => void;
}

export function createProgressStream(
  onProgress: (bytes: number, total?: number) => void,
  totalBytes?: number,
): ProgressStreamHandle {
  let bytesSoFar = 0;
  const stream = new Readable({ read: () => {} });
  return {
    stream,
    feed: (chunk: Buffer) => {
      bytesSoFar += chunk.length;
      onProgress(bytesSoFar, totalBytes);
      stream.push(chunk);
    },
    end: () => {
      stream.push(null);
    },
  };
}
