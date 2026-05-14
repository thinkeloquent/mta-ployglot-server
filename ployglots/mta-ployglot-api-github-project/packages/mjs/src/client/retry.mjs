import { GitHubHTTPError, RateLimitError } from './errors.mjs';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function isRetryable(res) {
  if (res.status >= 500 && res.status < 600) return { retry: true, kind: 'http5xx' };
  if (res.status === 403) {
    if (res.headers?.['x-ratelimit-remaining'] === '0') return { retry: true, kind: 'primary' };
    const body = typeof res.body === 'string' ? res.body : JSON.stringify(res.body ?? '');
    if (/secondary rate limit/i.test(body)) return { retry: true, kind: 'secondary' };
  }
  return { retry: false };
}

export async function withRetry(call, opts = {}) {
  const max = opts.maxAttempts ?? 3;
  const base = opts.baseDelayMs ?? 250;
  let lastRes;
  for (let attempt = 1; attempt <= max; attempt++) {
    const res = await call();
    lastRes = res;
    const { retry, kind } = isRetryable(res);
    if (!retry) return res;
    if (attempt === max) {
      if (kind === 'primary' || kind === 'secondary') throw new RateLimitError(res, kind);
      throw new GitHubHTTPError(res);
    }
    let delay;
    if (kind === 'primary' && res.headers?.['x-ratelimit-reset']) {
      delay = Math.max(0, Number(res.headers['x-ratelimit-reset']) * 1000 - Date.now());
    } else {
      const exp = base * Math.pow(2, attempt - 1);
      const jitter = exp * (0.8 + Math.random() * 0.4);
      delay = Math.round(jitter);
    }
    await sleep(delay);
  }
  return lastRes;
}
