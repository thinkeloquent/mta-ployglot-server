#!/usr/bin/env bash
# Example: one-off GET using the module-level convenience verb.
#
# Requires the `polyglot-fetch-http-client` package installed in the active
# interpreter (`make -C packages/py install`).
#
# Usage:
#   bash packages/py/examples/cli/01-one-off-request.sh https://httpbin.org/get
set -euo pipefail

url="${1:-https://httpbin.org/get}"

python -c "
import asyncio, json, sys
from fetch_http_client import get

async def main():
    resp = await get('${url}')
    resp.raise_for_status()
    sys.stdout.write(json.dumps(resp.json(), indent=2) + '\n')

asyncio.run(main())
"
