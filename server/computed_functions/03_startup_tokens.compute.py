"""03_startup_tokens — STARTUP. {case_001, case_005, timestamp_iso}, single shared timestamp."""
from __future__ import annotations
import time
from datetime import datetime, timezone

_ts = int(time.time() * 1000)
_ts_iso = datetime.fromtimestamp(_ts / 1000, tz=timezone.utc).isoformat()


def compute(_ctx, _path=None):
    return {
        "case_001": f"startup-001-{_ts}",
        "case_005": f"startup-005-{_ts}",
        "timestamp_iso": _ts_iso,
    }


scope = "STARTUP"
