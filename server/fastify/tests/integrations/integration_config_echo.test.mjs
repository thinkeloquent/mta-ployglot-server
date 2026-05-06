// Lock the `config_used` field shape across all six integration health routes.
//
// Yaml-driven assertions: rather than hard-coding expected base_url
// substrings per provider, the test asks the post-pipeline cfg
// (`getConfig().providers[name]`) for each provider's resolved
// `base_url` and `host` values, then asserts the route response matches.
// This makes the test a contract that the route faithfully reflects
// yaml without baking external knowledge of what URLs exist.
//
// Reuses `bootInProcess(env)` from `_boot.mjs` plus `_mock_origin.mjs`
// to start the server in-process against a local mock origin. Tests use
// vitest (the existing runner) so they run via `npm test`.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startMock } from "./_mock_origin.mjs";
import { bootInProcess } from "./_boot.mjs";
import { getConfig } from "@ployglot/app-yaml-fetch-config";

const PROVIDERS = [
  ["figma",      "/healthz/integrations/figma/me"],
  ["github",     "/healthz/integrations/github/user"],
  ["jira",       "/healthz/integrations/jira/myself"],
  ["saucelabs",  "/healthz/integrations/saucelabs/rest/v1/user"],
  ["statsig",    "/healthz/integrations/statsig/gates"],
  ["confluence", "/healthz/integrations/wiki/rest/api/user/current"],
];

const PROVIDER_ENV = [
  ["JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN"],
  ["CONFLUENCE_BASE_URL", "CONFLUENCE_EMAIL", "CONFLUENCE_API_TOKEN"],
  ["GITHUB_API_BASE_URL", "GITHUB_TOKEN"],
  ["FIGMA_API_BASE_URL", "FIGMA_TOKEN"],
  ["STATSIG_BASE_URL", "STATSIG_API_KEY"],
  ["SAUCELABS_BASE_URL", "SAUCE_USERNAME", "SAUCE_ACCESS_KEY"],
];

let mock;
let app;

beforeAll(async () => {
  mock = await startMock();
  const env = {};
  for (const [hostKey, ...credKeys] of PROVIDER_ENV) {
    env[hostKey] = mock.url;
    for (const k of credKeys) env[k] = "x";
  }
  app = await bootInProcess(env);
});

afterAll(async () => {
  await app?.close();
  await mock?.close();
});

describe("integration config_used", () => {
  for (const [provider, url] of PROVIDERS) {
    it(`${provider}: config_used present, masked, request id round-tripped`, async () => {
      const expectedBaseUrl = getConfig()?.providers?.[provider]?.base_url;
      expect(
        expectedBaseUrl,
        `${provider}: cfg.providers.${provider}.base_url empty — yaml or applier broken`,
      ).toBeTruthy();

      const rid = `sentinel-rid-${provider}`;
      const r = await fetch(`${app.baseUrl}${url}`, {
        headers: { "x-request-id": rid },
      });
      const body = await r.json();

      expect(
        body.host,
        `${provider}: route host mismatch (got ${body.host}, expected ${expectedBaseUrl} from cfg)`,
      ).toBe(expectedBaseUrl);

      const cu = body.config_used;
      expect(cu, `${provider}: config_used missing`).not.toBeNull();
      expect(
        cu?.base_url,
        `${provider}: config_used.base_url mismatch (got ${cu?.base_url}, expected ${expectedBaseUrl} from cfg)`,
      ).toBe(expectedBaseUrl);
      expect(
        cu?.endpoint_api_key,
        `${provider}: api key not masked`,
      ).toBe("***");
      const ridObserved =
        cu?.headers?.["X-Request-Id"] ?? cu?.headers?.["x-request-id"];
      expect(
        ridObserved,
        `${provider}: x-request-id not echoed (got ${ridObserved})`,
      ).toBe(rid);
    });
  }
});
