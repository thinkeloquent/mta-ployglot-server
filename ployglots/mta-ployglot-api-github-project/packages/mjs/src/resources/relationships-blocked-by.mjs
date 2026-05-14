const FIELD_NAME = 'Blocked by';

export function makeBlockedByField(fields) {
  const cache = new Map();
  return async function findOrCreate(projectId) {
    if (cache.has(projectId)) return cache.get(projectId);
    const all = [];
    for await (const f of fields.list(projectId)) all.push(f);
    let f = all.find(x => x.name === FIELD_NAME);
    if (!f) f = await fields.create(projectId, { name: FIELD_NAME, dataType: 'TEXT' });
    cache.set(projectId, f.id);
    return f.id;
  };
}

export { FIELD_NAME };
