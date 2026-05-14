#!/usr/bin/env node
// F05 / story 01 — listKeys() against endpoint.dev.yaml.
import { EndpointConfigSDK, loadConfigFromFile } from "@ployglot/app-yaml-fetch-config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(HERE, "../../../server/config/endpoint.dev.yaml");

loadConfigFromFile(FILE);
const sdk = new EndpointConfigSDK({ filePath: FILE });

const keys = sdk.listKeys().sort();
console.log(JSON.stringify({ endpoints: keys, count: keys.length }, null, 2));
