from __future__ import annotations

import inspect
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Dict, List, Union

from fastapi_server.bootstrap.contract import (
    LoaderReport,
    ResolvedBootstrapConfig,
    create_loader_report,
    report_error,
)

RunFn = Callable[[Any, ResolvedBootstrapConfig, Any], Union[LoaderReport, Awaitable[LoaderReport]]]


@dataclass
class Addon:
    name: str
    priority: int
    run: RunFn


@dataclass
class _Entry:
    addon: Addon
    insertion_index: int


class Registry:
    def __init__(self) -> None:
        self._entries: List[_Entry] = []
        self._counter = 0

    def register(self, addon: Addon) -> "Registry":
        if not isinstance(addon, Addon):
            raise TypeError("expected Addon instance")
        if not callable(addon.run):
            raise TypeError("addon.run must be callable")
        self._entries.append(_Entry(addon=addon, insertion_index=self._counter))
        self._counter += 1
        return self

    def list(self) -> List[Addon]:
        return [
            e.addon
            for e in sorted(self._entries, key=lambda e: (e.addon.priority, e.insertion_index))
        ]

    async def run_all(
        self,
        server: Any,
        config: ResolvedBootstrapConfig,
        ctx: Any,
    ) -> Dict[str, LoaderReport]:
        reports: Dict[str, LoaderReport] = {}
        for addon in self.list():
            try:
                result = addon.run(server, config, ctx)
                if inspect.isawaitable(result):
                    result = await result
                reports[addon.name] = result  # type: ignore[assignment]
            except Exception as err:  # noqa: BLE001
                fallback = create_loader_report(addon.name)
                report_error(fallback, "run", err)
                reports[addon.name] = fallback
        return reports


def compose_addons(*groups: Union[Addon, List[Addon]]) -> List[Addon]:
    out: List[Addon] = []
    for g in groups:
        if isinstance(g, list):
            out.extend(g)
        else:
            out.append(g)
    return out
