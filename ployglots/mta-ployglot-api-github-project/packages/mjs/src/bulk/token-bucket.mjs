/**
 * Refills `tokens` tokens over `intervalMs` — continuously, smoothly.
 * @param {{tokens:number, intervalMs:number, now?:() => number}} opts
 */
export function tokenBucket({ tokens, intervalMs, now = Date.now }) {
  const capacity = tokens;
  let available = capacity;
  let lastRefill = now();
  const tokensPerMs = capacity / intervalMs;

  function refill() {
    const t = now();
    const earned = (t - lastRefill) * tokensPerMs;
    if (earned > 0) {
      available = Math.min(capacity, available + earned);
      lastRefill = t;
    }
  }

  async function take(n = 1) {
    while (true) {
      refill();
      if (available >= n) { available -= n; return; }
      const need = n - available;
      const waitMs = Math.ceil(need / tokensPerMs);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }

  return { take };
}
