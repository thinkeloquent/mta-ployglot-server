#!/usr/bin/env python3
# Stdin: TOML bytes. Stdout: JSON string.
# Used by lib/manifest.sh as the parse step. Python 3.11+ for tomllib.
import sys
import json
import tomllib

json.dump(tomllib.load(sys.stdin.buffer), sys.stdout)
sys.stdout.write("\n")
