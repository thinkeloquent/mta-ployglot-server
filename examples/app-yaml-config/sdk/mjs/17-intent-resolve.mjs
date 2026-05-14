#!/usr/bin/env node
// F05 / story 02 — resolveIntent(intent) → { key, endpoint }, with default-intent fallback.
import { EndpointConfigSDK, loadConfigFromFile } from "@ployglot/app-yaml-fetch-config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(HERE, "../../../server/config/endpoint.dev.yaml");
loadConfigFromFile(FILE);
const sdk = new EndpointConfigSDK({ filePath: FILE });

const intents = ["chat", "persona", "agent", "storybook", "ui", "api", "nonexistent_intent"];
const out = Object.fromEntries(intents.map((i) => [i, sdk.resolveIntent(i).key]));
console.log(JSON.stringify(out, null, 2));
