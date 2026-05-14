"""Module-level functions — twin of packages/mjs/src/config.mjs."""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import yaml

from .errors import ConfigError
from .models import create_endpoint_config, create_fetch_config

logger = logging.getLogger(__name__)

_config: dict | None = None


def load_config(config: dict) -> dict:
    global _config
    _config = config
    return _config


def load_config_from_file(file_path: str) -> dict:
    global _config
    p = Path(file_path)
    if not p.exists():
        logger.warning("Config file not found: %s", file_path)
        _config = {"endpoints": {}, "intent_mapping": {}}
        return _config
    try:
        _config = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
        return _config
    except yaml.YAMLError as err:
        raise ConfigError(f"Failed to parse YAML: {err}")


def get_config() -> dict:
    if _config is None:
        raise ConfigError("Configuration not loaded.")
    return _config


def list_endpoints() -> list[str]:
    return list((get_config().get("endpoints") or {}).keys())


def get_endpoint(service_id: str) -> dict | None:
    clean_id = service_id.replace("endpoints.", "")
    endpoints = get_config().get("endpoints") or {}
    raw = endpoints.get(clean_id)
    if not raw:
        return None
    return create_endpoint_config(raw, clean_id)


def resolve_intent(intent: str) -> str:
    mapping = get_config().get("intent_mapping") or {}
    mappings = mapping.get("mappings") or {}
    default = mapping.get("default_intent") or "llm001"
    return mappings.get(intent) or default


def _compose_headers(endpoint: dict, custom_headers: dict | None) -> dict:
    headers = {"Content-Type": "application/json"}
    headers.update(endpoint.get("headers") or {})
    if custom_headers:
        headers.update(custom_headers)
    return headers


def _compose_body(endpoint: dict, payload: Any) -> str:
    if endpoint.get("bodyType") == "text":
        return str(payload)
    return json.dumps(payload)


def get_fetch_config(
    service_id: str,
    payload: Any,
    custom_headers: dict | None = None,
) -> dict:
    clean_id = service_id.replace("endpoints.", "")
    endpoint = get_endpoint(clean_id)
    if endpoint is None:
        available = list_endpoints()
        raise ConfigError(f"Service '{clean_id}' not found", clean_id, available)
    return create_fetch_config(
        serviceId=clean_id,
        url=endpoint["baseUrl"],
        method=endpoint["method"],
        headers=_compose_headers(endpoint, custom_headers),
        body=_compose_body(endpoint, payload),
        timeout=endpoint["timeout"],
    )


# Parity aliases — match the mjs camelCase surface for consumers that prefer it.
loadConfig = load_config
loadConfigFromFile = load_config_from_file
getConfig = get_config
listEndpoints = list_endpoints
getEndpoint = get_endpoint
resolveIntent = resolve_intent
getFetchConfig = get_fetch_config
