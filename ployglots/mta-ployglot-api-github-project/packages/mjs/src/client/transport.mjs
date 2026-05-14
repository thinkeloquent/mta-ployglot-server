/**
 * @param {object} opts
 * @param {string} opts.url
 * @param {string} [opts.method='POST']
 * @param {Record<string,string>} [opts.headers]
 * @param {string|Uint8Array} [opts.body]
 * @param {AbortSignal} [opts.signal]
 * @param {import('undici').Dispatcher} [opts.dispatcher]
 * @param {typeof fetch} [opts.fetch]
 * @returns {Promise<{ status: number, headers: Record<string,string>, body: unknown }>}
 */
export async function transport({ url, method = 'POST', headers, body, signal, dispatcher, fetch: customFetch } = {}) {
  const fetchFn = customFetch ?? globalThis.fetch;
  const init = { method, headers, body, signal };
  if (dispatcher !== undefined) init.dispatcher = dispatcher;
  const res = await fetchFn(url, init);
  const text = await res.text();
  const ct = res.headers.get('content-type') ?? '';
  let parsed;
  if (text === '') {
    parsed = null;
  } else if (ct.includes('application/json') || ct.includes('+json')) {
    try { parsed = JSON.parse(text); } catch { parsed = text; }
  } else {
    parsed = text;
  }
  const headerObj = {};
  for (const [k, v] of res.headers.entries()) headerObj[k] = v;
  return { status: res.status, headers: headerObj, body: parsed };
}
