// @ts-nocheck
/**
 * API-shape example: the minimum viable constructor call for every
 * supported mode, presented as a reference. No network I/O — this
 * file exists so downstream agents can copy/paste a stanza without
 * reading the whole SDK surface.
 *
 * Run: npx tsx examples/api/01-create-figma-client.ts
 */

import { APIKeyAuth, AsyncClient } from '@polyglot/fetch-http-client';
import { FigmaClient, fetchClientFromPolyglot } from '@polyglot/figma-api';

const TOKEN = process.env.FIGMA_PASS ?? 'figd_token_goes_here';

// Mode A — default transport, token + auto-detected proxy.
const a = new FigmaClient({ token: TOKEN, proxy: {} });

// Mode B — default transport, explicit proxy host.
const b = new FigmaClient({
  token: TOKEN,
  proxy: { host: 'http://proxy.corp:3128' },
});

// Mode C — default transport, explicit proxy host + auth.
const c = new FigmaClient({
  token: TOKEN,
  proxy: { host: 'http://proxy.corp:3128', user: 'u', pass: 'p' },
});

// Mode D — BYO outer AsyncClient (e.g. with custom retry).
const outer = new AsyncClient({
  baseUrl: 'https://api.figma.com',
  auth: new APIKeyAuth(TOKEN, 'X-Figma-Token'),
  retry: { maxRetries: 5 },
});
const d = new FigmaClient({ token: TOKEN, fetchClient: fetchClientFromPolyglot(outer) });

process.stdout.write(
  `Constructed 4 FigmaClients: ${[a, b, c, d].map((_, i) => String.fromCharCode(65 + i)).join(' ')}\n`,
);
