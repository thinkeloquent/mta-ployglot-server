#!/usr/bin/env python3
"""F05 / story 04 — refresh_config() against a temp endpoint.dev.yaml."""
from __future__ import annotations

import json
import shutil
import tempfile
from pathlib import Path

import yaml  # type: ignore[import-untyped]

from app_yaml_fetch_config import EndpointConfigSDK, load_config_from_file

HERE = Path(__file__).resolve().parent
SRC = (HERE / ".." / ".." / ".." / "server" / "config" / "endpoint.dev.yaml").resolve()

tmp_dir = Path(tempfile.mkdtemp(prefix="epcfg-"))
tmp_file = tmp_dir / "endpoint.dev.yaml"
shutil.copyfile(SRC, tmp_file)

load_config_from_file(str(tmp_file))
sdk = EndpointConfigSDK(file_path=str(tmp_file))

before = sorted(sdk.list_keys())

# Parse-modify-write so the new endpoint lands inside `endpoints:` (file ends with intent_mapping:).
doc = yaml.safe_load(tmp_file.read_text())
doc["endpoints"]["llm003"] = {
    "name": "Tertiary LLM",
    "tags": ["llm", "tertiary"],
    "baseUrl": "http://localhost:53000",
    "method": "POST",
    "headers": {"Content-Type": "application/json"},
    "timeout": 30000,
    "bodyType": "json",
}
tmp_file.write_text(yaml.safe_dump(doc))

sdk.refresh_config()
after = sorted(sdk.list_keys())
new_keys = [k for k in after if k not in before]

print(json.dumps({
    "before_count": len(before),
    "after_count": len(after),
    "new_keys": new_keys,
    "invariant_llm003_appeared": "llm003" in new_keys,
}, indent=2))
