"""Pin Response.status (text) + status_code (int) cross-codepath."""

from __future__ import annotations

from unittest.mock import Mock

import pytest

from fetch_http_client._client import Response


@pytest.mark.parametrize(
    "code,reason",
    [(200, "OK"), (404, "Not Found"), (500, "Internal Server Error")],
)
def test_response_status_fields(code: int, reason: str) -> None:
    raw = Mock()
    raw.status_code = code
    raw.reason_phrase = reason
    r = Response(raw)
    assert r.status_code == code
    assert r.status == reason


def test_response_status_unknown_code() -> None:
    raw = Mock()
    raw.status_code = 799
    raw.reason_phrase = ""
    r = Response(raw)
    assert r.status_code == 799
    assert r.status == ""
