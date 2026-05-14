/**
 * @param {Array<{id?:string,name:string,color?:string,description?:string}>} desired
 * @returns {Array<{id?:string,name:string,color:string,description:string}>}
 */
export function buildOptionUpsertList(desired) {
  return desired.map(o => ({
    ...(o.id ? { id: o.id } : {}),
    name: o.name,
    color: o.color ?? 'GRAY',
    description: o.description ?? '',
  }));
}
