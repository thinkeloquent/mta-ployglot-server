import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startMock } from "./_mock_origin.mjs";
import { bootInProcess } from "./_boot.mjs";

const PROVIDERS = [
  {
    name: "jira",
    url: "/healthz/integrations/jira/myself",
    envHostKey: "JIRA_BASE_URL",
    envExtras: { JIRA_EMAIL: "u", JIRA_API_TOKEN: "p" },
    dataKey: "data",
  },
  {
    name: "confluence",
    url: "/healthz/integrations/wiki/rest/api/user/current",
    envHostKey: "CONFLUENCE_BASE_URL",
    envExtras: { CONFLUENCE_EMAIL: "u", CONFLUENCE_API_TOKEN: "p" },
    dataKey: "data",
  },
  {
    name: "github",
    url: "/healthz/integrations/github/user",
    envHostKey: "GITHUB_API_BASE_URL",
    envExtras: { GITHUB_TOKEN: "tok" },
    dataKey: "data",
  },
  {
    name: "figma",
    url: "/healthz/integrations/figma/me",
    envHostKey: "FIGMA_API_BASE_URL",
    envExtras: { FIGMA_TOKEN: "tok" },
    dataKey: "data",
  },
  {
    name: "statsig",
    url: "/healthz/integrations/statsig/gates",
    envHostKey: "STATSIG_BASE_URL",
    envExtras: { STATSIG_API_KEY: "tok" },
    dataKey: "gates",
  },
  {
    name: "saucelabs",
    url: "/healthz/integrations/saucelabs/rest/v1/user",
    envHostKey: "SAUCELABS_BASE_URL",
    envExtras: { SAUCE_USERNAME: "u", SAUCE_ACCESS_KEY: "p" },
    dataKey: "org_vms",
  },
];

let mock;
let app;

beforeAll(async () => {
  mock = await startMock();
  const env = {};
  for (const p of PROVIDERS) {
    env[p.envHostKey] = mock.url;
    Object.assign(env, p.envExtras);
  }
  app = await bootInProcess(env);
});

afterAll(async () => {
  await app?.close();
  await mock?.close();
});

describe("integration routes", () => {
  for (const p of PROVIDERS) {
    it(`${p.name} returns expected shape`, async () => {
      const r = await fetch(`${app.baseUrl}${p.url}`);
      expect(r.status).toBe(200);
      const body = await r.json();
      expect(body.service).toBe(p.name);
      expect(body).toHaveProperty(p.dataKey);
    });
  }
});
