"""NarratorAgent: evaluates story arc progression and generates directives.

Replaces the inline LLM orchestration in narrator_service.evaluate_and_direct().
"""

from __future__ import annotations

from typing import Any

import structlog

from app.models.schemas import Message, StateData

log = structlog.get_logger()

NARRATOR_AGENT_SYSTEM_PROMPT = """\
You are the Narrator Agent for an AI-powered RPG storytelling application.
Your role is to evaluate story arc progression, update node statuses,
and generate narrative directives that guide the AI storyteller.

You have access to:
- The story arc definition (goal, themes, tone, nodes)
- Current active directives
- Current RPG state
- Recent conversation history

Based on recent events, determine:
1. Which story nodes should change status (pending → active, active → completed, etc.)
2. What new narrative directives to generate (introduce characters, advance quests,
   create dilemmas, set atmosphere, reveal information, foreshadow, adjust pacing)
3. How to adjust the tension level (-3 to +3)

Return your decisions as a structured JSON object."""


async def run_narrator_evaluation(
    session_id: str,
    branch_msgs: list[Message],
    state: StateData | None,
    connection_id: str | None = None,
) -> dict:
    """Run narrator evaluation.

    Currently delegates to the existing implementation;
    Phase 4 will convert to use deepagents.
    """
    from app.services.narrator_service import evaluate_and_direct

    return await evaluate_and_direct(
        session_id=session_id,
        branch_msgs=branch_msgs,
        state=state,
        connection_id=connection_id,
    )


async def create_narrator_agent(
    api_key: str,
    base_url: str,
    model_name: str,
    tools: list[Any] | None = None,
) -> Any:
    """Create a compiled NarratorAgent using deepagents."""
    try:
        from deepagents import create_deep_agent
        from app.agents.models import create_dynamic_model

        model = create_dynamic_model(api_key, base_url, model_name)

        agent = create_deep_agent(
            name="narrator_agent",
            model=model,
            tools=tools or [],
            system_prompt=NARRATOR_AGENT_SYSTEM_PROMPT,
            debug=False,
        )
        log.info("narrator_agent_created", model=model_name)
        return agent
    except ImportError:
        log.warning("deepagents_not_installed", action="narrator_agent_skipped")
        return None
