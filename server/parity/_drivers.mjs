function normalizeProvider(body) {
  const { host: _h, ...rest } = body ?? {};
  return rest;
}

// `raw` stage's `data` is keyed by absolute file paths that differ between
// runtimes (e.g. `.dev/fastify-app/config/...` vs `.dev/fastapi/config/...`).
// Strip the directory prefix so deep-equal compares basenames only.
function normalizeRawStage(body) {
  if (!body || typeof body !== "object" || !body.data) return body;
  const out = {};
  for (const [k, v] of Object.entries(body.data)) {
    const basename = k.split("/").pop();
    out[basename] = v;
  }
  return { ...body, data: out };
}

const ENDPOINTS = [
  { name: "jira", url: "/healthz/integrations/jira/myself", normalize: normalizeProvider },
  { name: "confluence", url: "/healthz/integrations/wiki/rest/api/user/current", normalize: normalizeProvider },
  { name: "github", url: "/healthz/integrations/github/user", normalize: normalizeProvider },
  { name: "figma", url: "/healthz/integrations/figma/me", normalize: normalizeProvider },
  { name: "statsig", url: "/healthz/integrations/statsig/gates", normalize: normalizeProvider },
  { name: "saucelabs", url: "/healthz/integrations/saucelabs/rest/v1/user", normalize: normalizeProvider },
  { name: "stage-raw", url: "/healthz/app-yaml-stage/raw", normalize: normalizeRawStage },
  { name: "stage-merged", url: "/healthz/app-yaml-stage/merged" },
  { name: "stage-applied", url: "/healthz/app-yaml-stage/applied" },
  { name: "stage-derived", url: "/healthz/app-yaml-stage/derived" },
];

export async function fetchOne(baseUrl, endpoint) {
  const r = await fetch(`${baseUrl}${endpoint.url}`);
  const body = await r.json();
  const normalize = endpoint.normalize ?? ((b) => b);
  return { status: r.status, body: normalize(body) };
}

export { ENDPOINTS };
