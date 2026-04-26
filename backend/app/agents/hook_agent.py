"""HookAgent: runs chat hooks as agent-executed tasks.

Supports two modes:
- Batch mode (default): Single agent call with all hook prompts in one system prompt.
- Individual mode (opt-in): Each hook spawns a sub-agent with isolated tools.
"""

from __future__ import annotations

import json
import re
from typing import Any

import structlog

from app.models.schemas import ChatHook, Message, StateData, WSMessageOut
from app.storage.hook_storage import list_hooks

log = structlog.get_logger()

BATCH_HOOK_SYSTEM_PROMPT = """\
You are the Hook Execution Agent. You receive conversation context and a list of
analysis tasks. Each task has a response key and a description of what to analyze.
Execute all tasks and return a JSON object where each key maps to its result.

Available context: recent conversation messages and optionally the current RPG state.
Return ONLY a JSON object. Do not include any text outside the JSON."""


def _build_state_summary(state: StateData) -> str:
    """Build a compact state summary for hook context."""
    rpg = state.rpg_summary
    parts = []
    if rpg.protagonist_summary:
        parts.append(f"主角: {rpg.protagonist_summary}")
    if rpg.scene_summary:
        parts.append(f"场景: {rpg.scene_summary}")
    if rpg.active_quest:
        parts.append(f"任务: {rpg.active_quest}")
    if rpg.key_inventory:
        parts.append(f"物品: {rpg.key_inventory}")
    if rpg.recent_events:
        parts.append(f"近期事件: {rpg.recent_events}")
    if rpg.nearby_npcs:
        parts.append(f"附近NPC: {rpg.nearby_npcs}")
    return "\n".join(parts) if parts else ""


def _extract_json(text: str) -> Any:
    """Robust JSON extraction from LLM output."""
    stripped = text.strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass
    match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", stripped)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    for start_char in ('{', '['):
        idx = stripped.find(start_char)
        if idx != -1:
            try:
                return json.loads(stripped[idx:])
            except json.JSONDecodeError:
                pass
    return None


async def run_hooks_for_event(
    session_id: str,
    trigger: str,
    branch_msgs: list[Message],
    state: StateData | None,
    connection_id: str | None,
    push_fn: Any,
) -> None:
    """Run all enabled hooks for a trigger event.

    This is the agent-based replacement for hook_runner.run_hooks_for_event.
    Currently delegates to the existing batch LLM implementation;
    Phase 3 will convert to use deepagents.
    """
    # For now, delegate to the existing implementation
    from app.services.hook_runner import run_hooks_for_event as _original_run

    await _original_run(
        session_id=session_id,
        trigger=trigger,
        branch_msgs=branch_msgs,
        state=state,
        connection_id=connection_id,
        push_fn=push_fn,
    )


async def create_hook_agent(
    api_key: str,
    base_url: str,
    model_name: str,
    tools: list[Any] | None = None,
) -> Any:
    """Create a compiled HookAgent using deepagents."""
    try:
        from deepagents import create_deep_agent
        from app.agents.models import create_dynamic_model

        model = create_dynamic_model(api_key, base_url, model_name)

        agent = create_deep_agent(
            name="hook_agent",
            model=model,
            tools=tools or [],
            system_prompt=BATCH_HOOK_SYSTEM_PROMPT,
            debug=False,
        )
        log.info("hook_agent_created", model=model_name)
        return agent
    except ImportError:
        log.warning("deepagents_not_installed", action="hook_agent_skipped")
        return None
