from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Any, Callable, Coroutine

import structlog

log = structlog.get_logger()

Listener = Callable[..., Coroutine[Any, Any, None]]


class EventBus:
    def __init__(self) -> None:
        self._listeners: dict[str, list[Listener]] = defaultdict(list)

    def on(self, event: str, listener: Listener) -> None:
        self._listeners[event].append(listener)

    def off(self, event: str, listener: Listener) -> None:
        self._listeners[event] = [l for l in self._listeners[event] if l is not listener]

    async def emit(self, event: str, **kwargs: Any) -> None:
        for listener in self._listeners.get(event, []):
            try:
                asyncio.create_task(listener(**kwargs))
            except Exception:
                log.exception("event_listener_error", event=event)

    def clear(self) -> None:
        self._listeners.clear()


event_bus = EventBus()
