/**
 * Find all simple cycles in a directed graph.
 * @param {{nodes:{itemId?:string,id?:string}[], edges:{from:string|null,to:string}[]}} graph
 * @returns {string[][]} list of cycles (each cycle is a list of node ids forming the loop, last == first)
 */
export function findCycles(graph) {
  const adj = new Map();
  for (const n of graph.nodes) adj.set(n.id ?? n.itemId, []);
  for (const e of graph.edges) {
    if (!e.from || !e.to) continue;
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from).push(e.to);
  }
  const cycles = [];
  const visiting = new Set();
  const visited = new Set();
  const stack = [];

  function dfs(u) {
    visiting.add(u); stack.push(u);
    for (const v of adj.get(u) ?? []) {
      const i = stack.indexOf(v);
      if (i !== -1) {
        cycles.push([...stack.slice(i), v]);
      } else if (!visited.has(v)) {
        dfs(v);
      }
    }
    visiting.delete(u);
    visited.add(u);
    stack.pop();
  }

  for (const n of graph.nodes) {
    const id = n.id ?? n.itemId;
    if (!visited.has(id)) dfs(id);
  }
  return cycles;
}
