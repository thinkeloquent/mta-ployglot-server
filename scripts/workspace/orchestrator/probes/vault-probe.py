#!/usr/bin/env python3
"""vault-probe.py — check that each KEY argument resolves to a non-empty
value in os.environ. Emits one JSON line per key on stdout.

DEVIATION FROM PLAN: the plan called this a "vault probe" against a vault
module. The codebase has no vault module — env keys come straight from
os.environ. This probe checks that source directly.

Usage: python vault-probe.py KEY1 KEY2 KEY3 ...
"""
import json
import os
import sys

for key in sys.argv[1:]:
    v = os.environ.get(key)
    ok = isinstance(v, str) and len(v) > 0
    print(json.dumps({
        "key": key,
        "twin": "fastapi",
        "ok": ok,
        "value_length": len(v) if ok else None,
    }))
