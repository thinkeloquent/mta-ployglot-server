#!/usr/bin/env python3
"""F03 / story 02 — {{app.X}} + {{request.X}} against synthetic context."""
from __future__ import annotations

import asyncio
import json

from runtime_template_resolver import MissingStrategy, create_resolver


async def main():
    r = create_resolver(missing_strategy=MissingStrategy.IGNORE)
    ctx = {
        "app": {"name": "demo", "version": "1.2.3"},
        "request": {"headers": {"x-request-id": "req-001"}, "method": "POST"},
    }
    out = {
        "app.name": await r.resolve("{{app.name}}", ctx),
        "app.version": await r.resolve("{{app.version}}", ctx),
        "request.headers.x-request-id": await r.resolve("{{request.headers.x-request-id}}", ctx),
        "request.method": await r.resolve("{{request.method}}", ctx),
        "missing_with_default": await r.resolve('{{app.missing.key | "n/a"}}', ctx),
    }
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
