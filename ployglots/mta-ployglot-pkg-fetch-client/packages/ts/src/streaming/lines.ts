// @ts-nocheck
import { Readable } from 'node:stream';
import logger from '../logger.js';
import { iterText } from './text.js';

const log = logger.create('@polyglot/fetch-http-client', 'streaming/lines.ts');

export async function* iterLines(
  stream: Readable,
  encoding: string = 'utf-8',
): AsyncGenerator<string> {
  let buffer = '';
  for await (const text of iterText(stream, encoding)) {
    buffer += text;
    let idx: number;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      let line = buffer.slice(0, idx);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      yield line;
      buffer = buffer.slice(idx + 1);
    }
  }
  if (buffer.length > 0) yield buffer;
}

export async function* iterNDJSON<T = unknown>(
  stream: Readable,
  encoding: string = 'utf-8',
): AsyncGenerator<T> {
  for await (const line of iterLines(stream, encoding)) {
    if (!line.trim()) continue;
    try {
      yield JSON.parse(line) as T;
    } catch (err) {
      log.warn('failed to parse NDJSON line', { line, error: String(err) });
    }
  }
}

export async function collectLines(
  stream: Readable,
  encoding: string = 'utf-8',
): Promise<string[]> {
  const out: string[] = [];
  for await (const l of iterLines(stream, encoding)) out.push(l);
  return out;
}

export interface SSEEvent {
  event?: string;
  data: string;
  id?: string;
  retry?: number;
}

export async function* iterSSE(stream: Readable): AsyncGenerator<SSEEvent> {
  let event: string | undefined;
  let dataLines: string[] = [];
  let id: string | undefined;
  let retry: number | undefined;

  for await (const rawLine of iterLines(stream)) {
    if (rawLine === '') {
      if (dataLines.length > 0) {
        const evt: SSEEvent = { data: dataLines.join('\n') };
        if (event !== undefined) evt.event = event;
        if (id !== undefined) evt.id = id;
        if (retry !== undefined) evt.retry = retry;
        yield evt;
      }
      event = undefined;
      dataLines = [];
      retry = undefined;
      continue;
    }
    if (rawLine.startsWith(':')) continue;

    const colonIdx = rawLine.indexOf(':');
    let field: string;
    let value: string;
    if (colonIdx < 0) {
      field = rawLine;
      value = '';
    } else {
      field = rawLine.slice(0, colonIdx);
      value = rawLine.slice(colonIdx + 1);
      if (value.startsWith(' ')) value = value.slice(1);
    }

    switch (field) {
      case 'event':
        event = value;
        break;
      case 'data':
        dataLines.push(value);
        break;
      case 'id':
        id = value;
        break;
      case 'retry': {
        const n = parseInt(value, 10);
        if (!Number.isNaN(n)) retry = n;
        break;
      }
      default:
        break;
    }
  }

  if (dataLines.length > 0) {
    const evt: SSEEvent = { data: dataLines.join('\n') };
    if (event !== undefined) evt.event = event;
    if (id !== undefined) evt.id = id;
    if (retry !== undefined) evt.retry = retry;
    yield evt;
  }
}
