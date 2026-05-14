#!/usr/bin/env python3
"""F03 / story 04 — security guard rejects __class__/__dict__ etc."""
from __future__ import annotations

import asyncio
import json

from runtime_template_resolver import SecurityError, create_resolver


async def main():
    r = create_resolver()
    out = {}

    try:
        await r.resolve("{{__class__.__name__}}", {})
        out["class_attempt"] = "<unexpected: did not raise>"
    except SecurityError:
        out["class_attempt"] = "<caught: SecurityError>"
    except Exception as e:
        out["class_attempt"] = f"<caught: {type(e).__name__}>"

    try:
        await r.resolve("{{__dict__.foo}}", {})
        out["dict_attempt"] = "<unexpected: did not raise>"
    except SecurityError:
        out["dict_attempt"] = "<caught: SecurityError>"
    except Exception as e:
        out["dict_attempt"] = f"<caught: {type(e).__name__}>"

    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
