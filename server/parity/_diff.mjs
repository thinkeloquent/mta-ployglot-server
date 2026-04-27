const DEFAULT_TOLERATED = new Set([]);

export function structuralDiff(a, b, path = "$") {
  const out = [];
  if (typeof a !== typeof b) {
    out.push(`${path}: type mismatch (${typeof a} vs ${typeof b})`);
    return out;
  }
  if (a === null || b === null) {
    if (a !== b) out.push(`${path}: ${a} vs ${b}`);
    return out;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      out.push(`${path}: length ${a.length} vs ${b.length}`);
    }
    const min = Math.min(a.length, b.length);
    for (let i = 0; i < min; i++) {
      out.push(...structuralDiff(a[i], b[i], `${path}[${i}]`));
    }
    return out;
  }
  if (typeof a === "object") {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (!(k in a)) {
        out.push(`${path}.${k}: missing on fastify`);
        continue;
      }
      if (!(k in b)) {
        out.push(`${path}.${k}: missing on fastapi`);
        continue;
      }
      out.push(...structuralDiff(a[k], b[k], `${path}.${k}`));
    }
    return out;
  }
  if (a !== b) out.push(`${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
  return out;
}

export function applyTolerances(diffs, tolerated = DEFAULT_TOLERATED) {
  return diffs.filter((d) => !tolerated.has(d.split(":")[0]));
}
