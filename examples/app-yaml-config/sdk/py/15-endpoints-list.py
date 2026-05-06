#!/usr/bin/env python3
"""F05 / story 01 — list_keys() against endpoint.dev.yaml."""
from __future__ import annotations

import json
from pathlib import Path

from app_yaml_fetch_config import EndpointConfigSDK, load_config_from_file

HERE = Path(__file__).resolve().parent
FILE = (HERE / ".." / ".." / ".." / "server" / "config" / "endpoint.dev.yaml").resolve()

load_config_from_file(str(FILE))
sdk = EndpointConfigSDK(file_path=str(FILE))

keys = sorted(sdk.list_keys())
print(json.dumps({"endpoints": keys, "count": len(keys)}, indent=2))
