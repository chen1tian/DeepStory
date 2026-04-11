from __future__ import annotations

import json
import re

import structlog

from app.models.schemas import ChatHook, Message, StateData
from app.services.llm_service import chat_completion
from app.storage.hook_storage import list_hooks

log = structlog.get_logger()


def _extract_json(text: str) -> dict | list | None:
    """Try to extract JSON from LLM response, handling markdown code blocks."""
    # Try raw parse first
    stripped = text.strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass

    # Try to extract from ```json ... ``` block
    match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", stripped)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # Try to find first { or [ and parse from there
    for start_char, end_char in [('{', '}'), ('[', ']')]:
        idx = stripped.find(start_char)
        if idx != -1:
            # Find matching closing bracket
            try:
                return json.loads(stripped[idx:])
            except json.JSONDecodeError:
                pass

    return None


def _build_state_summary(state: StateData) -> str:
    """Build a compact state summary string for hook context injection."""
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


async def run_hooks_for_event(
    session_id: str,
    trigger: str,
    branch_msgs: list[Message],
    state: StateData | None,
    connection_id: str | None,
    push_fn,  # async callable(WSMessageOut)
) -> None:
    """
    Load all enabled hooks matching `trigger`, batch them into one LLM call,
    then push individual `hook_result` WS messages for each hook.
    """
    all_hooks_raw = await list_hooks()
    hooks: list[ChatHook] = [
        ChatHook(**d)
        for d in all_hooks_raw
        if d.get("enabled") and d.get("trigger") == trigger
    ]

    if not hooks:
        return

    # Determine how many context messages to include (use max across all hooks)
    max_ctx = max(h.context_messages for h in hooks)
    recent_msgs = branch_msgs[-max_ctx:] if max_ctx > 0 else []

    # Format conversation context
    conversation_text = "\n".join(
        f"{'用户' if m.role == 'user' else 'AI'}: {m.content}"
        for m in recent_msgs
        if m.role in ("user", "assistant")
    )

    # Build state context (only if any hook needs it)
    state_text = ""
    if state and any(h.include_state for h in hooks):
        state_text = _build_state_summary(state)

    # Build the batched system prompt
    hook_instructions = []
    for h in hooks:
        schema_hint = h.response_schema or "字符串"
        hook_instructions.append(
            f'  "{h.response_key}": {schema_hint} — 任务：{h.prompt}'
        )

    system_prompt = (
        "你是一个根据对话内容执行多个分析任务的助手。\n"
        "请严格返回一个 JSON 对象，包含以下键（不要添加任何 markdown 格式或额外说明）：\n"
        + "\n".join(hook_instructions)
    )

    # Build user message
    user_parts = []
    if state_text:
        user_parts.append(f"【当前状态】\n{state_text}")
    if conversation_text:
        user_parts.append(f"【最近对话】\n{conversation_text}")
    else:
        user_parts.append("（对话内容为空）")

    user_message = "\n\n".join(user_parts)

    # Determine connection: prefer hook-specific, fall back to session connection
    # If hooks have different connections, use the first non-None one; otherwise session default
    hook_conn = next((h.connection_id for h in hooks if h.connection_id), None)
    effective_conn = hook_conn or connection_id

    try:
        raw_response = await chat_completion(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            connection_id=effective_conn,
        )
        log.info("hook_runner_called", session_id=session_id, trigger=trigger, hook_count=len(hooks))
    except Exception:
        log.exception("hook_runner_llm_failed", session_id=session_id, trigger=trigger)
        return

    # Parse the batched JSON response
    parsed = _extract_json(raw_response)
    if not isinstance(parsed, dict):
        log.warning("hook_runner_parse_failed", session_id=session_id, raw=raw_response[:200])
        return

    # Dispatch individual hook results
    from app.models.schemas import WSMessageOut

    for h in hooks:
        result = parsed.get(h.response_key)
        if result is None:
            log.warning("hook_runner_missing_key", hook_id=h.id, key=h.response_key)
            continue

        await push_fn(WSMessageOut(
            type="hook_result",
            data={
                "hook_id": h.id,
                "hook_name": h.name,
                "action": h.action.model_dump(),
                "result": result,
            },
        ))
        log.debug("hook_result_pushed", hook_id=h.id, hook_name=h.name)
