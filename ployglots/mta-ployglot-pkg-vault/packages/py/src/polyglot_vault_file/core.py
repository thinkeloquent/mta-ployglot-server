"""Core codec — JSON encode/decode, version normalize, .env parser."""
from __future__ import annotations

import json
import os
from typing import Dict

from .domain import VaultFile
from .logger import Logger, IVaultFileLogger


log: IVaultFileLogger = Logger.create("polyglot_vault_file", "core")


def normalize_version(version: str) -> str:
    parts = version.split(".")
    while len(parts) < 3:
        parts.append("0")
    return ".".join(parts[:3])


def to_json(vault_file: VaultFile) -> str:
    return vault_file.model_dump_json(indent=2, by_alias=True)


def from_json(json_str: str) -> VaultFile:
    if not isinstance(json_str, str) or not json_str:
        raise ValueError("Invalid JSON input: input is empty or not a string")
    data = json.loads(json_str)
    header = data.get("header")
    if isinstance(header, dict) and isinstance(header.get("version"), str):
        header["version"] = normalize_version(header["version"])
    return VaultFile.model_validate(data)


def parse_env_file(file_path: str) -> Dict[str, str]:
    if not file_path:
        raise ValueError("File path is required")
    if not os.path.exists(file_path):
        return {}

    with open(file_path, "r", encoding="utf-8") as f:
        contents = f.read()

    out: Dict[str, str] = {}
    for raw_line in contents.split("\n"):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        eq = line.find("=")
        if eq < 0:
            log.warn(f"line without '=' skipped: {line}")
            continue
        key = line[:eq].strip()
        value = line[eq + 1 :].strip()
        if (value.startswith('"') and value.endswith('"')) or (
            value.startswith("'") and value.endswith("'")
        ):
            value = value[1:-1]
        out[key] = value
    return out
