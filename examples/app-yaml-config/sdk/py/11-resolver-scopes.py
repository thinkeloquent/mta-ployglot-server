#!/usr/bin/env python3
"""F03 / story 04 — STARTUP cache, REQUEST fresh, REQUEST-in-STARTUP literal rule."""
from __future__ import annotations

import asyncio
import json

from runtime_template_resolver import (
    ComputeRegistry, ComputeScope, MissingStrategy, create_resolver,
)


async def main():
    # SDK note: COMPUTE_PATTERN regex permits no dots in fn name. Bare {{fn:foo}} only.
    reg = ComputeRegistry()
    counter = {"n": 0}
    def s(_ctx, _path=None):
        counter["n"] += 1
        return counter["n"]
    def q(_ctx, _path=None):
        counter["n"] += 1
        return counter["n"]
    reg.register("startup_tokens", s, ComputeScope.STARTUP)
    reg.register("request_token",  q, ComputeScope.REQUEST)

    r = create_resolver(registry=reg, missing_strategy=MissingStrategy.IGNORE)

    startup_first  = await r.resolve("{{fn:startup_tokens}}", {}, ComputeScope.REQUEST)
    startup_second = await r.resolve("{{fn:startup_tokens}}", {}, ComputeScope.REQUEST)
    request_first  = await r.resolve("{{fn:request_token}}",  {}, ComputeScope.REQUEST)
    request_second = await r.resolve("{{fn:request_token}}",  {}, ComputeScope.REQUEST)
    request_in_startup = await r.resolve("{{fn:request_token}}", {}, ComputeScope.STARTUP)

    print(json.dumps({
        "startup_first": startup_first,
        "startup_second": startup_second,
        "startup_cached": startup_first == startup_second,
        "request_first": request_first,
        "request_second": request_second,
        "request_fresh": request_first != request_second,
        "request_in_startup_context": request_in_startup,
        "request_in_startup_is_literal": request_in_startup == "{{fn:request_token}}",
    }, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
