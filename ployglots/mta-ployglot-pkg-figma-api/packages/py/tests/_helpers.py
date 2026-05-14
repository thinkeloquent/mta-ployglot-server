"""Shared test helpers.

Builds a fake FetchClient that matches the protocol FigmaClient
consumes, so every unit test can assert the exact path / params / body
the client would have sent.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any


@dataclass
class RecordedCall:
    method: str
    path: str
    kwargs: dict[str, Any]


@dataclass
class FakeResponse:
    status: int
    body: Any = None
    text_value: str = ""
    headers_map: dict[str, str] = field(default_factory=dict)

    @property
    def status_code(self) -> int:
        return self.status

    @property
    def headers(self) -> dict[str, str]:
        return self.headers_map

    @property
    def text(self) -> str:
        return self.text_value or ""

    def json(self) -> Any:
        if self.body is None:
            raise ValueError("no body")
        return self.body


class FakeFetchClient:
    def __init__(self, responder: Callable[[RecordedCall], FakeResponse]) -> None:
        self.calls: list[RecordedCall] = []
        self.closed = False
        self._responder = responder

    async def _verb(self, method: str, path: str, **kwargs: Any) -> FakeResponse:
        call = RecordedCall(method=method, path=path, kwargs=kwargs)
        self.calls.append(call)
        return self._responder(call)

    async def get(self, path: str, **kwargs: Any) -> FakeResponse:
        return await self._verb("GET", path, **kwargs)

    async def post(self, path: str, **kwargs: Any) -> FakeResponse:
        return await self._verb("POST", path, **kwargs)

    async def put(self, path: str, **kwargs: Any) -> FakeResponse:
        return await self._verb("PUT", path, **kwargs)

    async def delete(self, path: str, **kwargs: Any) -> FakeResponse:
        return await self._verb("DELETE", path, **kwargs)

    async def patch(self, path: str, **kwargs: Any) -> FakeResponse:
        return await self._verb("PATCH", path, **kwargs)

    async def aclose(self) -> None:
        self.closed = True
