#!/usr/bin/env node
// F05 / story 01 — getByTag(tag) against endpoint.dev.yaml.
import { EndpointConfigSDK, loadConfigFromFile } from "@ployglot/app-yaml-fetch-config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(HERE, "../../../server/config/endpoint.dev.yaml");

loadConfigFromFile(FILE);
const sdk = new EndpointConfigSDK({ filePath: FILE });

const keysOf = (eps) => eps.map((e) => e.serviceId ?? e.key ?? e.name).sort();

const out = {
  llm: keysOf(sdk.getByTag("llm")),
  api: keysOf(sdk.getByTag("api")),
  agent: keysOf(sdk.getByTag("agent")),
  none: keysOf(sdk.getByTag("does-not-exist")),
};
console.log(JSON.stringify(out, null, 2));
