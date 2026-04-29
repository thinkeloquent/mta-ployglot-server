#!/usr/bin/env python3
"""F05 / story 02 — resolve_intent(intent)."""
from __future__ import annotations

import json
from pathlib import Path

from app_yaml_fetch_config import EndpointConfigSDK, load_config_from_file

HERE = Path(__file__).resolve().parent
FILE = (HERE / ".." / ".." / ".." / "server" / "config" / "endpoint.dev.yaml").resolve()
load_config_from_file(str(FILE))
sdk = EndpointConfigSDK(file_path=str(FILE))

intents = ["chat", "persona", "agent", "storybook", "ui", "api", "nonexistent_intent"]
out = {}
for i in intents:
    r = sdk.resolve_intent(i)
    # py SDK returns dict {key, endpoint} parity with mjs
    out[i] = r["key"] if isinstance(r, dict) else r
print(json.dumps(out, indent=2))
