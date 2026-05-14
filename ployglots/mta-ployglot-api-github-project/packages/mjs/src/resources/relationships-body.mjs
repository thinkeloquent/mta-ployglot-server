export function makeBodyHelpers(client, resolveRef) {
  async function appendToBody(issueRef, suffix) {
    const r = await resolveRef(issueRef);
    const issue = await client.rest('GET', `/repos/${r.owner}/${r.repo}/issues/${r.number}`);
    const cur = issue.body ?? '';
    const sep = cur.length === 0 || cur.endsWith('\n') ? '' : '\n';
    const body = cur + sep + suffix;
    return client.rest('PATCH', `/repos/${r.owner}/${r.repo}/issues/${r.number}`, { body });
  }

  async function addComment(issueRef, body) {
    const r = await resolveRef(issueRef);
    return client.rest('POST', `/repos/${r.owner}/${r.repo}/issues/${r.number}/comments`, { body });
  }

  async function patchBody(issueRef, mutator) {
    const r = await resolveRef(issueRef);
    const issue = await client.rest('GET', `/repos/${r.owner}/${r.repo}/issues/${r.number}`);
    const body = mutator(issue.body ?? '');
    return client.rest('PATCH', `/repos/${r.owner}/${r.repo}/issues/${r.number}`, { body });
  }

  return { appendToBody, addComment, patchBody };
}
