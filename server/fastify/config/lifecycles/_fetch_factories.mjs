import {
  AsyncClient,
  BasicAuth,
  BearerAuth,
  APIKeyAuth,
} from "@polyglot/fetch-http-client";
import { buildProxy, optionalEnv, requireEnv } from "./_shared_fetch.mjs";

function withProxy(opts) {
  const proxy = buildProxy({});
  return proxy ? { ...opts, proxy } : opts;
}

export function makeJiraClient() {
  return new AsyncClient(withProxy({
    baseUrl: requireEnv("JIRA_BASE_URL"),
    auth: new BasicAuth(requireEnv("JIRA_EMAIL"), requireEnv("JIRA_API_TOKEN")),
    headers: { accept: "application/json" },
  }));
}

export function makeConfluenceClient() {
  // Strip a trailing `/wiki` (and any trailing slash) from the env so route paths
  // can carry the full `/wiki/rest/api/...` prefix without double-prefixing
  // when CONFLUENCE_BASE_URL is set to `https://<tenant>.atlassian.net/wiki`.
  const baseUrl = requireEnv("CONFLUENCE_BASE_URL").replace(/\/wiki\/?$/, "").replace(/\/$/, "");
  // Atlassian Cloud Basic auth username is the account email. The platform
  // reference (server.dev.yaml + env_resolver.env_confluence_x) reads it from
  // CONFLUENCE_USERNAME; older docs use CONFLUENCE_EMAIL. Accept either.
  const username = optionalEnv("CONFLUENCE_USERNAME", "") || requireEnv("CONFLUENCE_EMAIL");
  return new AsyncClient(withProxy({
    baseUrl,
    auth: new BasicAuth(username, requireEnv("CONFLUENCE_API_TOKEN")),
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-atlassian-token": "no-check",
    },
  }));
}

export function makeGithubClient() {
  return new AsyncClient(withProxy({
    baseUrl: optionalEnv("GITHUB_API_BASE_URL", "https://api.github.com"),
    auth: new BearerAuth(requireEnv("GITHUB_TOKEN")),
    headers: {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
    },
  }));
}

export function makeFigmaClient() {
  return new AsyncClient(withProxy({
    baseUrl: optionalEnv("FIGMA_API_BASE_URL", "https://api.figma.com"),
    auth: new APIKeyAuth(requireEnv("FIGMA_TOKEN"), "X-Figma-Token"),
    headers: { accept: "application/json" },
  }));
}

export function makeStatsigClient() {
  return new AsyncClient(withProxy({
    baseUrl: optionalEnv("STATSIG_BASE_URL", "https://statsigapi.net/console/v1"),
    auth: new APIKeyAuth(requireEnv("STATSIG_API_KEY"), "STATSIG-API-KEY"),
    headers: { accept: "application/json" },
  }));
}

export function makeSaucelabsClient() {
  return new AsyncClient(withProxy({
    baseUrl: optionalEnv("SAUCELABS_BASE_URL", "https://api.us-west-1.saucelabs.com"),
    auth: new BasicAuth(requireEnv("SAUCE_USERNAME"), requireEnv("SAUCE_ACCESS_KEY")),
    headers: { accept: "application/json" },
  }));
}

export const FACTORIES = {
  jira: makeJiraClient,
  confluence: makeConfluenceClient,
  github: makeGithubClient,
  figma: makeFigmaClient,
  statsig: makeStatsigClient,
  saucelabs: makeSaucelabsClient,
};

export const PROVIDERS = Object.freeze(Object.keys(FACTORIES));
