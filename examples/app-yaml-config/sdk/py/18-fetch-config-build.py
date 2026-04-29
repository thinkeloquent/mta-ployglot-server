#!/usr/bin/env python3
"""F05 / story 03 — get_fetch_config(serviceId, payload, custom_headers)."""
from __future__ import annotations

import json
from pathlib import Path

from app_yaml_fetch_config import EndpointConfigSDK, load_config_from_file

HERE = Path(__file__).resolve().parent
FILE = (HERE / ".." / ".." / ".." / "server" / "config" / "endpoint.dev.yaml").resolve()
load_config_from_file(str(FILE))
sdk = EndpointConfigSDK(file_path=str(FILE))

llm001 = sdk.get_fetch_config("llm001", {"prompt": "Hello"}, {"X-Trace-Id": "trace-001"})
fastify_ep = sdk.get_fetch_config("fastify", None)
agents = sdk.get_fetch_config("agents001", {"task": "ping"})

print(json.dumps({"llm001": llm001, "fastify": fastify_ep, "agents001": agents}, indent=2, default=str))
