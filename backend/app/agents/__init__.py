"""DeepAgents multi-agent system for Creative Chat.

This package provides agent-based orchestration for chat, hooks,
and narrator evaluation using the deepagents framework.
"""

from app.agents.models import create_dynamic_model
from app.agents.registry import AgentRegistry, agent_registry
from app.agents.chat_agent import create_chat_agent
from app.agents.hook_agent import create_hook_agent, run_hooks_for_event
from app.agents.narrator_agent import create_narrator_agent, run_narrator_evaluation

__all__ = [
    "create_dynamic_model",
    "AgentRegistry",
    "agent_registry",
    "create_chat_agent",
    "create_hook_agent",
    "run_hooks_for_event",
    "create_narrator_agent",
    "run_narrator_evaluation",
]
