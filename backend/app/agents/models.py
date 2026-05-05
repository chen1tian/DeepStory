"""Dynamic model factory for creating LangChain chat models from stored connections."""

from __future__ import annotations

import structlog
from langchain_openai import ChatOpenAI

from app.config import settings

log = structlog.get_logger()


async def resolve_connection_params(
    connection_id: str | None = None,
    connection_type: str = "llm",
) -> tuple[str, str, str, float]:
    """Resolve (api_key, base_url, model_name, temperature) from a stored connection or env defaults.

    Mirrors the resolution logic in llm_service.get_client_and_model().
    """
    from app.storage.connection_storage import load_connection, list_connections

    conn_data = None
    if connection_id:
        conn_data = await load_connection(connection_id)
        if conn_data and conn_data.get("connection_type", "llm") != connection_type:
            conn_data = None

    if not conn_data:
        conns = await list_connections()
        filtered = [c for c in conns if c.get("connection_type", "llm") == connection_type]
        for c in filtered:
            if c.get("is_default"):
                conn_data = c
                break
        if not conn_data and filtered:
            conn_data = filtered[0]

    if not conn_data:
        api_key = settings.api_key or ""
        base_url = str(settings.api_base_url) if settings.api_base_url else "https://api.openai.com/v1"
        model_name = settings.model_name or "gpt-4o-mini"
        temperature = 1.0
    else:
        api_key = conn_data.get("api_key") or settings.api_key or ""
        base_url = conn_data.get("api_base_url") or str(settings.api_base_url) if settings.api_base_url else "https://api.openai.com/v1"
        model_name = conn_data.get("model_name") or settings.model_name or "gpt-4o-mini"
        temperature = conn_data.get("temperature", 1.0)

    return api_key, base_url, model_name, float(temperature)


def create_dynamic_model(
    api_key: str,
    base_url: str,
    model_name: str,
    streaming: bool = True,
    temperature: float = 1.0,
) -> ChatOpenAI:
    """Create a LangChain ChatOpenAI model from connection parameters.

    Returns a ChatOpenAI instance suitable for use with deepagents/LangGraph agents.
    """
    return ChatOpenAI(
        model=model_name,
        api_key=api_key,
        base_url=base_url,
        streaming=streaming,
        temperature=temperature,
        timeout=60.0,
        max_retries=2,
    )


async def create_model_from_connection(
    connection_id: str | None = None,
    connection_type: str = "llm",
    streaming: bool = True,
    temperature: float | None = None,
) -> ChatOpenAI:
    """Create a LangChain ChatOpenAI from a stored connection ID.

    Convenience helper that combines resolve_connection_params + create_dynamic_model.
    """
    api_key, base_url, model_name, resolved_temperature = await resolve_connection_params(
        connection_id, connection_type
    )
    model = create_dynamic_model(
        api_key,
        base_url,
        model_name,
        streaming,
        resolved_temperature if temperature is None else temperature,
    )
    log.debug(
        "agent_model_created",
        model=model_name,
        base_url=base_url[:60],
        streaming=streaming,
    )
    return model
