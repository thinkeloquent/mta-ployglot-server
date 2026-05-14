import { makeIssueRefResolver } from './relationships-issueref.mjs';
import { makeBodyHelpers } from './relationships-body.mjs';
import { makeBlockedByField } from './relationships-blocked-by.mjs';

function parseRefs(s) {
  return (s ?? '').split(',').map(t => t.trim()).filter(Boolean);
}

function joinRefs(arr) {
  return [...new Set(arr)].join(', ');
}

export function makeRelationships(client, { fields, items, values }) {
  const resolveRef = makeIssueRefResolver(client);
  const body = makeBodyHelpers(client, resolveRef);
  const blockedByFor = makeBlockedByField(fields);

  // ---- sub-issues ----
  async function listSubIssues(parentRef) {
    const p = await resolveRef(parentRef);
    return client.rest('GET', `/repos/${p.owner}/${p.repo}/issues/${p.number}/sub_issues`);
  }

  async function addSubIssue(parentRef, childRef) {
    const [p, c] = await Promise.all([resolveRef(parentRef), resolveRef(childRef)]);
    return client.rest('POST', `/repos/${p.owner}/${p.repo}/issues/${p.number}/sub_issues`, {
      sub_issue_id: c.databaseId,
    });
  }

  async function removeSubIssue(parentRef, childRef) {
    const [p, c] = await Promise.all([resolveRef(parentRef), resolveRef(childRef)]);
    return client.rest('DELETE', `/repos/${p.owner}/${p.repo}/issues/${p.number}/sub_issue`, {
      sub_issue_id: c.databaseId,
    });
  }

  async function reorderSubIssues(parentRef, orderedChildRefs) {
    const p = await resolveRef(parentRef);
    const ids = await Promise.all(orderedChildRefs.map(async r => (await resolveRef(r)).databaseId));
    return client.rest('PATCH', `/repos/${p.owner}/${p.repo}/issues/${p.number}/sub_issues/priority`, {
      sub_issue_ids: ids,
    });
  }

  async function reparentSubIssue(childRef, newParentRef) {
    const child = await resolveRef(childRef);
    const issue = await client.rest('GET', `/repos/${child.owner}/${child.repo}/issues/${child.number}`);
    const oldParent = issue?.parent;
    if (oldParent) {
      await client.rest(
        'DELETE',
        `/repos/${oldParent.repository.owner.login}/${oldParent.repository.name}/issues/${oldParent.number}/sub_issue`,
        { sub_issue_id: child.databaseId },
      );
    }
    return addSubIssue(newParentRef, childRef);
  }

  // ---- cross-repo ----
  function refToken(target) {
    return `${target.owner}/${target.repo}#${target.number}`;
  }

  async function link(sourceRef, targetRef, { keyword = '', mode = 'body' } = {}) {
    const target = await resolveRef(targetRef);
    const line = (keyword ? `${keyword} ` : '') + refToken(target);
    if (mode === 'comment') {
      const c = await body.addComment(sourceRef, line);
      return { mode, commentId: c.id };
    }
    await body.appendToBody(sourceRef, line);
    return { mode };
  }

  async function unlink(sourceRef, targetRef, { commentId } = {}) {
    if (commentId) {
      const r = await resolveRef(sourceRef);
      return client.rest('DELETE', `/repos/${r.owner}/${r.repo}/issues/comments/${commentId}`);
    }
    const target = await resolveRef(targetRef);
    const token = refToken(target);
    return body.patchBody(sourceRef, (b) =>
      b.split('\n').filter(line => !line.includes(token)).join('\n'),
    );
  }

  // ---- dependencies ----
  async function refTokenForRef(itemRef) {
    const r = await resolveRef(itemRef);
    return refToken(r);
  }

  async function depsAdd(projectId, itemId, blockedByItemRef) {
    const fieldId = await blockedByFor(projectId);
    const cur = await values.get(itemId, fieldId);
    const refs = parseRefs(cur?.value);
    refs.push(await refTokenForRef(blockedByItemRef));
    return values.set(projectId, itemId, fieldId, joinRefs(refs));
  }

  async function depsRemove(projectId, itemId, blockedByItemRef) {
    const fieldId = await blockedByFor(projectId);
    const cur = await values.get(itemId, fieldId);
    const token = await refTokenForRef(blockedByItemRef);
    const refs = parseRefs(cur?.value).filter(r => r !== token);
    return values.set(projectId, itemId, fieldId, joinRefs(refs));
  }

  async function depsList(projectId, itemId) {
    const fieldId = await blockedByFor(projectId);
    const cur = await values.get(itemId, fieldId);
    return parseRefs(cur?.value);
  }

  function urlToToken(url) {
    if (!url) return null;
    return url.replace('https://github.com/', '').replace('/issues/', '#').replace('/pull/', '#');
  }

  async function depsGraph(projectId) {
    const fieldId = await blockedByFor(projectId);
    const nodes = [];
    const tokenIndex = new Map();
    const itemsList = [];

    for await (const item of items.list(projectId)) {
      const ref = urlToToken(item.content?.url);
      nodes.push({ itemId: item.id, ref });
      if (ref) tokenIndex.set(ref, item.id);
      itemsList.push(item);
    }

    const edges = [];
    for (const item of itemsList) {
      const fv = item.fieldValues.find(v => v.fieldId === fieldId);
      if (!fv?.value) continue;
      for (const blockerRef of parseRefs(fv.value)) {
        edges.push({ from: tokenIndex.get(blockerRef) ?? null, fromRef: blockerRef, to: item.id });
      }
    }
    return { nodes, edges };
  }

  return {
    subIssues: { list: listSubIssues, add: addSubIssue, remove: removeSubIssue, reorder: reorderSubIssues, reparent: reparentSubIssue },
    crossRepo: { link, unlink },
    dependencies: { add: depsAdd, remove: depsRemove, list: depsList, graph: depsGraph },
    _internals: { resolveRef, blockedByFor },
  };
}
