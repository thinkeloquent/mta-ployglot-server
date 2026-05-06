// Yaml ↔ factory parity: each `make<Provider>Client` faithfully consumes
// its cfg slice. Catches drift between yaml and factory builder helpers —
// e.g. if yaml gains a new provider but the factory map isn't updated, or
// if a new auth type lands in yaml that the helper switch doesn't handle.
//
// Asserts shape (baseUrl + auth class) without booting the full Fastify
// lifecycle: monkey-patches the fetch-config singleton with a synthetic
// cfg dict, calls each factory directly, and inspects the AsyncClient.

import { describe, it, expect, beforeAll } from "vitest";
import { loadConfig } from "@ployglot/app-yaml-fetch-config";
import {
  APIKeyAuth,
  BasicAuth,
  BearerAuth,
} from "@polyglot/fetch-http-client";

import { FACTORIES } from "../../config/lifecycles/_fetch_factories.mjs";

const FAKE_CFG = {
  providers: {
    figma: {
      base_url: "https://figma.example.com",
      endpoint_auth_type: "custom",
      api_auth_header_name: "X-Figma-Token",
      endpoint_api_key: "figma-tok",
      headers: { Accept: "application/json", "X-Request-Id": null },
    },
    github: {
      base_url: "https://github.example.com",
      endpoint_auth_type: "bearer",
      endpoint_api_key: "gh-tok",
      headers: { Accept: "application/vnd.github+json" },
    },
    jira: {
      base_url: "https://jira.example.com",
      endpoint_auth_type: "basic_email_token",
      email: "u@x",
      endpoint_api_key: "jira-tok",
      headers: { Accept: "application/json" },
    },
    confluence: {
      base_url: "https://wiki.example.com/wiki",
      endpoint_auth_type: "basic_email_token",
      email: "u@x",
      endpoint_api_key: "conf-tok",
      headers: { Accept: "application/json" },
    },
    saucelabs: {
      base_url: "https://sauce.example.com",
      endpoint_auth_type: "basic",
      username: "sauce-u",
      endpoint_api_key: "sauce-key",
      headers: {},
    },
    statsig: {
      base_url: "https://statsig.example.com",
      endpoint_auth_type: "custom_header",
      api_auth_header_name: "statsig-api-key",
      endpoint_api_key: "statsig-tok",
      headers: {},
    },
  },
};

const EXPECTED = [
  ["figma",      "https://figma.example.com",      APIKeyAuth],
  ["github",     "https://github.example.com",     BearerAuth],
  ["jira",       "https://jira.example.com",       BasicAuth],
  ["confluence", "https://wiki.example.com",       BasicAuth], // /wiki stripped
  ["saucelabs",  "https://sauce.example.com",      BasicAuth],
  ["statsig",    "https://statsig.example.com",    APIKeyAuth],
];

beforeAll(() => {
  loadConfig(FAKE_CFG);
});

describe("fetch factory ↔ yaml parity", () => {
  it("FACTORIES keys match yaml providers keys", () => {
    const factoryKeys = Object.keys(FACTORIES).sort();
    const yamlKeys = Object.keys(FAKE_CFG.providers).sort();
    expect(factoryKeys).toEqual(yamlKeys);
  });

  for (const [provider, expectedBaseUrl, AuthClass] of EXPECTED) {
    it(`${provider}: factory consumes cfg slice (base_url + auth class)`, async () => {
      const factory = FACTORIES[provider];
      const client = factory();
      try {
        const actual = client._baseUrl?.toString().replace(/\/$/, "");
        expect(actual).toBe(expectedBaseUrl);
        expect(client._auth).toBeInstanceOf(AuthClass);
      } finally {
        await client.close?.();
      }
    });
  }
});
