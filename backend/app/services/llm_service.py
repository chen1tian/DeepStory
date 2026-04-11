from __future__ import annotations

import asyncio
from typing import AsyncIterator

import structlog
from openai import AsyncOpenAI, APIError, APITimeoutError, APIConnectionError

from app.config import settings

log = structlog.get_logger()

_clients: dict[str, AsyncOpenAI] = {}


async def get_client_and_model(connection_id: str | None = None) -> tuple[AsyncOpenAI, str]:
    from app.storage.connection_storage import load_connection, list_connections

    conn_data = None
    if connection_id:
        conn_data = await load_connection(connection_id)

    if not conn_data:
        conns = await list_connections()
        for c in conns:
            if c.get("is_default"):
                conn_data = c
                break
        if not conn_data and conns:
            conn_data = conns[0]

    if not conn_data:
        # Fallback to env
        api_key = settings.api_key or ""
        base_url = str(settings.api_base_url) if settings.api_base_url else "https://api.openai.com/v1"
        model_name = settings.model_name or "gpt-4o-mini"
    else:
        api_key = conn_data.get("api_key") or settings.api_key or ""
        base_url = conn_data.get("api_base_url") or str(settings.api_base_url) if settings.api_base_url else "https://api.openai.com/v1"
        model_name = conn_data.get("model_name") or settings.model_name or "gpt-4o-mini"

    cache_key = f"{base_url}:{api_key}"
    if cache_key not in _clients:
        _clients[cache_key] = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url,
            timeout=60.0,
        )

    return _clients[cache_key], model_name


_RETRYABLE = (APITimeoutError, APIConnectionError)


async def chat_completion(messages: list[dict], connection_id: str | None = None, **kwargs) -> str:
    """Non-streaming chat completion with retry."""
    client, model_name = await get_client_and_model(connection_id)
    last_err: Exception | None = None
    for attempt in range(3):
        try:
            resp = await client.chat.completions.create(
                model=model_name,
                messages=messages,
                timeout=30.0,
                **kwargs,
            )
            return resp.choices[0].message.content or ""
        except _RETRYABLE as e:
            last_err = e
            wait = 2 ** attempt
            log.warning("llm_retry", attempt=attempt + 1, error=str(e), wait=wait)
            await asyncio.sleep(wait)
        except APIError as e:
            if e.status_code and e.status_code >= 500:
                last_err = e
                wait = 2 ** attempt
                log.warning("llm_retry_5xx", attempt=attempt + 1, status=e.status_code, wait=wait)
                await asyncio.sleep(wait)
            else:
                raise
    raise last_err  # type: ignore[misc]


async def chat_completion_stream(messages: list[dict], connection_id: str | None = None, **kwargs) -> AsyncIterator[str]:
    """Streaming chat completion with retry on initial connection."""
    client, model_name = await get_client_and_model(connection_id)
    last_err: Exception | None = None
    for attempt in range(3):
        try:
            stream = await client.chat.completions.create(
                model=model_name,
                messages=messages,
                stream=True,
                timeout=60.0,
                **kwargs,
            )
            async for chunk in stream:
                delta = chunk.choices[0].delta if chunk.choices else None
                if delta and delta.content:
                    yield delta.content
            return
        except _RETRYABLE as e:
            last_err = e
            wait = 2 ** attempt
            log.warning("llm_stream_retry", attempt=attempt + 1, error=str(e), wait=wait)
            await asyncio.sleep(wait)
        except APIError as e:
            if e.status_code and e.status_code >= 500:
                last_err = e
                wait = 2 ** attempt
                log.warning("llm_stream_retry_5xx", attempt=attempt + 1, status=e.status_code, wait=wait)
                await asyncio.sleep(wait)
            else:
                raise
    raise last_err  # type: ignore[misc]
