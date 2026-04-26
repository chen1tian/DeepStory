"""ChatAgent: orchestrates the user-message-to-response lifecycle.

Phase 1 (streaming): save → load context → build prompt → stream → save
Phase 2 (background): summarize → hooks → extract state → narrator → hooks
"""

from __future__ import annotations

from typing import Any

import structlog

log = structlog.get_logger()

CHAT_AGENT_SYSTEM_PROMPT = """\
You are the Chat Coordinator Agent for an AI-powered RPG storytelling application.
Your task is to process a user's chat message and generate a narrative response.

Execute these tools in strict sequential order for Phase 1 (streaming response):
1. save_user_message — persist the user's message with role="user"
2. load_context — load session, branch messages, summary, and state
3. build_prompt — assemble the message array with token budgeting
4. stream_response — call the LLM and stream tokens to the WebSocket (this returns the full response)
5. save_assistant_message — persist the assistant's response with role="assistant"

After Phase 1, report the message IDs. Phase 2 (background processing) will
be handled separately by a background task via the tool functions directly.
Do NOT call Phase 2 tools (check_should_summarize, summarize_conversation,
run_hooks, extract_rpg_state, narrator_evaluate_tool)."""


async def create_chat_agent(
    api_key: str,
    base_url: str,
    model_name: str,
    tools: list[Any] | None = None,
) -> Any:
    """Create a compiled ChatAgent using deepagents.

    The agent orchestrates Phase 1 of chat processing. Phase 2 is run
    separately by calling tool functions directly in a background task.
    """
    try:
        from deepagents import create_deep_agent
        from app.agents.models import create_dynamic_model

        model = create_dynamic_model(api_key, base_url, model_name)

        agent = create_deep_agent(
            name="chat_agent",
            model=model,
            tools=tools or [],
            system_prompt=CHAT_AGENT_SYSTEM_PROMPT,
            debug=False,
        )
        log.info("chat_agent_created", model=model_name)
        return agent
    except ImportError:
        log.warning("deepagents_not_installed", action="chat_agent_skipped")
        return None
