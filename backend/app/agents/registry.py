"""AgentRegistry manages agent lifecycle: creation, caching, and cleanup."""

from __future__ import annotations

from typing import Any

import structlog

log = structlog.get_logger()


class AgentRegistry:
    """Manages compiled deepagent instances and cached models.

    Each model configuration (keyed by base_url:api_key) gets its own
    agent instances. The registry handles invalidation when connections
    change and cleanup on shutdown.
    """

    def __init__(self) -> None:
        # Compiled agent graphs keyed by (agent_type, connection_hash)
        self._agents: dict[str, Any] = {}
        # Cached ChatOpenAI instances keyed by (base_url, api_key)
        self._models: dict[str, Any] = {}

    def get_model(self, base_url: str, api_key: str) -> Any | None:
        """Get a cached LangChain model."""
        key = f"{base_url}:{api_key}"
        return self._models.get(key)

    def set_model(self, base_url: str, api_key: str, model: Any) -> None:
        """Cache a LangChain model."""
        key = f"{base_url}:{api_key}"
        self._models[key] = model
        log.debug("agent_model_cached", key=key[:60])

    def get_agent(self, agent_type: str, connection_hash: str) -> Any | None:
        """Get a cached compiled agent graph."""
        key = f"{agent_type}:{connection_hash}"
        return self._agents.get(key)

    def set_agent(self, agent_type: str, connection_hash: str, agent: Any) -> None:
        """Cache a compiled agent graph."""
        key = f"{agent_type}:{connection_hash}"
        self._agents[key] = agent
        log.debug("agent_cached", type=agent_type)

    def invalidate_model(self, base_url: str, api_key: str) -> None:
        """Remove cached model (e.g. when connection credentials change)."""
        model_key = f"{base_url}:{api_key}"
        self._models.pop(model_key, None)
        # Also remove any agents using this model
        keys_to_remove = [k for k in self._agents if model_key in k]
        for k in keys_to_remove:
            self._agents.pop(k, None)
        log.info("agent_cache_invalidated", model=model_key[:60])

    def clear(self) -> None:
        """Clear all cached agents and models."""
        self._agents.clear()
        self._models.clear()
        log.info("agent_registry_cleared")


# Module-level singleton used across the application
agent_registry = AgentRegistry()
