const ENDPOINTS = [
  { name: "jira", url: "/healthz/integrations/jira/myself" },
  { name: "confluence", url: "/healthz/integrations/wiki/rest/api/user/current" },
  { name: "github", url: "/healthz/integrations/github/user" },
  { name: "figma", url: "/healthz/integrations/figma/me" },
  { name: "statsig", url: "/healthz/integrations/statsig/gates" },
  { name: "saucelabs", url: "/healthz/integrations/saucelabs/rest/v1/user" },
];

function normalize(body) {
  const { host: _h, ...rest } = body ?? {};
  return rest;
}

export async function fetchOne(baseUrl, endpoint) {
  const r = await fetch(`${baseUrl}${endpoint.url}`);
  const body = await r.json();
  return { status: r.status, body: normalize(body) };
}

export { ENDPOINTS };
