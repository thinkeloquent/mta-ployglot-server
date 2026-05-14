#!/usr/bin/env python3
"""F05 / story 01 — get_by_tag(tag)."""
from __future__ import annotations

import json
from pathlib import Path

from app_yaml_fetch_config import EndpointConfigSDK, load_config_from_file

HERE = Path(__file__).resolve().parent
FILE = (HERE / ".." / ".." / ".." / "server" / "config" / "endpoint.dev.yaml").resolve()

load_config_from_file(str(FILE))
sdk = EndpointConfigSDK(file_path=str(FILE))


def keys_of(eps):
    return sorted(e.get("serviceId") or e.get("key") or e.get("name") for e in eps)


print(json.dumps({
    "llm": keys_of(sdk.get_by_tag("llm")),
    "api": keys_of(sdk.get_by_tag("api")),
    "agent": keys_of(sdk.get_by_tag("agent")),
    "none": keys_of(sdk.get_by_tag("does-not-exist")),
}, indent=2))
