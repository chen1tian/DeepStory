from __future__ import annotations

import asyncio
from typing import AsyncIterator

import structlog
from openai import AsyncOpenAI, APIError, APITimeoutError, APIConnectionError

from app.config import settings

log = structlog.get_logger()

_client: AsyncOpenAI | None = None


def get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            api_key=settings.api_key,
            base_url=settings.api_base_url,
            timeout=60.0,
        )
    return _client


_RETRYABLE = (APITimeoutError, APIConnectionError)


async def chat_completion(messages: list[dict], **kwargs) -> str:
    """Non-streaming chat completion with retry."""
    client = get_client()
    last_err: Exception | None = None
    for attempt in range(3):
        try:
            resp = await client.chat.completions.create(
                model=settings.model_name,
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


async def chat_completion_stream(messages: list[dict], **kwargs) -> AsyncIterator[str]:
    """Streaming chat completion with retry on initial connection."""
    client = get_client()
    last_err: Exception | None = None
    for attempt in range(3):
        try:
            stream = await client.chat.completions.create(
                model=settings.model_name,
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
