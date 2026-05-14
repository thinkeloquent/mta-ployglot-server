// @ts-nocheck
import { Readable } from 'node:stream';
import { Headers } from '../models/headers.js';
import { RequestOptionsError } from '../exceptions/base.js';
import type { RequestBody } from '../models/request.js';

export interface FileUpload {
  name: string;
  filename: string;
  content: Buffer | Readable | Blob | string;
  contentType?: string;
}

export interface BodyOptions {
  json?: unknown;
  data?: Record<string, unknown> | URLSearchParams;
  content?: string | Buffer | Uint8Array | Readable;
  files?: FileUpload[];
}

export interface ProcessedBody {
  body: RequestBody;
  headers: Headers;
}

function isSet(v: unknown): boolean {
  return v !== undefined && v !== null;
}

async function readableToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  return Buffer.concat(chunks);
}

export function processBody(options: BodyOptions, existingHeaders?: Headers): ProcessedBody {
  const headers = existingHeaders ? existingHeaders.clone() : new Headers();
  const setCount = [options.json, options.data, options.content].filter(isSet).length;
  if (setCount > 1) {
    throw new RequestOptionsError(
      'Conflicting body options: only one of json/data/content allowed',
    );
  }

  if (options.files && options.files.length > 0) {
    const dataRec =
      options.data && !(options.data instanceof URLSearchParams)
        ? (options.data as Record<string, unknown>)
        : undefined;
    const { body, contentType } = buildMultipartFormData(options.files, dataRec);
    if (!headers.has('content-type')) headers.set('Content-Type', contentType);
    return { body: body as unknown as RequestBody, headers };
  }

  if (isSet(options.json)) {
    const body = JSON.stringify(options.json);
    if (!headers.has('content-type')) headers.set('Content-Type', 'application/json');
    return { body, headers };
  }

  if (isSet(options.data)) {
    if (options.data instanceof URLSearchParams) {
      if (!headers.has('content-type')) {
        headers.set('Content-Type', 'application/x-www-form-urlencoded');
      }
      return { body: options.data.toString(), headers };
    }
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(options.data as Record<string, unknown>)) {
      params.append(k, String(v));
    }
    if (!headers.has('content-type')) {
      headers.set('Content-Type', 'application/x-www-form-urlencoded');
    }
    return { body: params.toString(), headers };
  }

  if (isSet(options.content)) {
    return { body: options.content as RequestBody, headers };
  }

  return { body: null, headers };
}

export function hasBodyOptions(options: BodyOptions): boolean {
  return (
    isSet(options.json) ||
    isSet(options.data) ||
    isSet(options.content) ||
    Boolean(options.files && options.files.length > 0)
  );
}

export function buildMultipartFormData(
  files: FileUpload[],
  data?: Record<string, unknown>,
): { body: FormData; contentType: string } {
  const form = new FormData();
  if (data) {
    for (const [k, v] of Object.entries(data)) form.append(k, String(v));
  }
  for (const file of files) {
    let blob: Blob;
    if (file.content instanceof Blob) {
      blob = file.content;
    } else if (typeof file.content === 'string') {
      blob = new Blob([file.content], file.contentType ? { type: file.contentType } : undefined);
    } else if (Buffer.isBuffer(file.content) || file.content instanceof Uint8Array) {
      const src = file.content as Buffer | Uint8Array;
      const u8 = new Uint8Array(src.buffer, src.byteOffset, src.byteLength);
      blob = new Blob([u8], file.contentType ? { type: file.contentType } : undefined);
    } else {
      // Readable stream — synchronous-style FormData append requires a Blob; flag this as
      // unsupported for now (matches source behaviour: synchronous path only).
      throw new RequestOptionsError(
        'Streaming file uploads not supported; pre-buffer to Buffer or Blob',
      );
    }
    form.append(file.name, blob, file.filename);
  }
  return { body: form, contentType: 'multipart/form-data' };
}

export { readableToBuffer };
