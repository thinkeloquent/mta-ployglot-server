#!/usr/bin/env python3
"""F03 / story 03 — {{fn:foo}} + composite-property access via the SDK.

COMPUTE_PATTERN regex permits no dots in fn name; composite property syntax is
implemented as: function returns object → consumer dot-accesses programmatically.
"""
from __future__ import annotations

import asyncio
import json
import uuid

from runtime_template_resolver import (
    ComputeRegistry, ComputeScope, MissingStrategy, create_resolver,
)


async def main():
    reg = ComputeRegistry()
    reg.register("app_metadata",
                 lambda _ctx, _path=None: {"name": "demo", "version": "1.2.3", "started_at": "2026-04-27T00:00:00Z"},
                 ComputeScope.STARTUP)
    reg.register("request_id",
                 lambda _ctx, _path=None: str(uuid.uuid4()),
                 ComputeScope.REQUEST)

    r = create_resolver(registry=reg, missing_strategy=MissingStrategy.IGNORE)

    metadata = await r.resolve("{{fn:app_metadata}}", {}, ComputeScope.REQUEST)
    a = await r.resolve("{{fn:request_id}}", {}, ComputeScope.REQUEST)
    b = await r.resolve("{{fn:request_id}}", {}, ComputeScope.REQUEST)

    print(json.dumps({
        "metadata_full": metadata,
        "metadata_version_via_property_access": metadata.get("version") if isinstance(metadata, dict) else None,
        "metadata_started_via_property_access": metadata.get("started_at") if isinstance(metadata, dict) else None,
        "request_id_first": "<uuid>",
        "request_id_second": "<uuid>",
        "request_fresh_per_call": a != b,
        "missing_fn_with_default": await r.resolve('{{fn:nope | "missing-fn-default"}}', {}, ComputeScope.REQUEST),
    }, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
