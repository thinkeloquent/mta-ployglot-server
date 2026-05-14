"""Pure data factories — twin of packages/mjs/src/models.mjs."""
from __future__ import annotations

from typing import Any


def create_endpoint_config(data: dict, key: str = "") -> dict:
    return {
        "key": key,
        "name": data.get("name") or key,
        "tags": list(data.get("tags") or []),
        "baseUrl": data.get("baseUrl") or data.get("baseurl") or "",
        "description": data.get("description") or "",
        "method": data.get("method") or "POST",
        "headers": dict(data.get("headers") or {}),
        "timeout": data.get("timeout") if data.get("timeout") is not None else 30000,
        "bodyType": data.get("bodyType") or "json",
    }


def create_fetch_config(
    *,
    serviceId: str,
    url: str,
    method: str,
    headers: dict,
    body: Any,
    timeout: int,
) -> dict:
    return {
        "serviceId": serviceId,
        "url": url,
        "method": method,
        "headers": headers,
        "body": body,
        "headersTimeout": timeout,
    }


createEndpointConfig = create_endpoint_config
createFetchConfig = create_fetch_config
