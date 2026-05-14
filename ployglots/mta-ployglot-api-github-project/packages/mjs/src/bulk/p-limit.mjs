/**
 * @param {number} max — concurrent in-flight tasks.
 * @returns {<T>(fn: () => Promise<T>) => Promise<T>}
 */
export function pLimit(max) {
  if (!Number.isInteger(max) || max < 1) throw new Error('max must be positive integer');
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= max || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    Promise.resolve().then(fn).then(
      v => { active--; resolve(v); next(); },
      e => { active--; reject(e); next(); },
    );
  };
  return (fn) => new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    next();
  });
}
