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

    Supports agent_mode: "batch" (default, all hooks in one LLM call) or
    "individual" (each hook gets its own sub-agent call in the future).
    """
    all_hooks_raw = await list_hooks()
    hooks: list[ChatHook] = [
        ChatHook(**d)
        for d in all_hooks_raw
        if d.get("enabled") and d.get("trigger") == trigger
    ]

    if not hooks:
        return

    # Split hooks by agent_mode
    batch_hooks = [h for h in hooks if h.agent_mode != "individual"]
    individual_hooks = [h for h in hooks if h.agent_mode == "individual"]

    # Execute batch hooks in one LLM call
    if batch_hooks:
        await _execute_batch_hooks(
            session_id, trigger, batch_hooks, branch_msgs, state, connection_id, push_fn
        )

    # Execute individual hooks (one LLM call per hook)
    for hook in individual_hooks:
        await _execute_individual_hook(
            session_id, hook, branch_msgs, state, connection_id, push_fn
        )


async def _execute_batch_hooks(
    session_id: str,
    trigger: str,
    hooks: list[ChatHook],
    branch_msgs: list[Message],
    state: StateData | None,
    connection_id: str | None,
    push_fn,
) -> None:
    """Execute multiple hooks in a single batched LLM call."""
    max_ctx = max(h.context_messages for h in hooks)
    recent_msgs = branch_msgs[-max_ctx:] if max_ctx > 0 else []

    conversation_text = "\n".join(
        f"{'用户' if m.role == 'user' else 'AI'}: {m.content}"
        for m in recent_msgs
        if m.role in ("user", "assistant")
    )

    state_text = ""
    if state and any(h.include_state for h in hooks):
        state_text = _build_state_summary(state)

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

    user_parts = []
    if state_text:
        user_parts.append(f"【当前状态】\n{state_text}")
    if conversation_text:
        user_parts.append(f"【最近对话】\n{conversation_text}")
    else:
        user_parts.append("（对话内容为空）")

    user_message = "\n\n".join(user_parts)

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

    parsed = _extract_json(raw_response)
    if not isinstance(parsed, dict):
        log.warning("hook_runner_parse_failed", session_id=session_id, raw=raw_response[:200])
        return

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

        # Process after-hook callback
        await _process_after_hook_callback(h, result, session_id, push_fn)


async def _execute_individual_hook(
    session_id: str,
    hook: ChatHook,
    branch_msgs: list[Message],
    state: StateData | None,
    connection_id: str | None,
    push_fn,
) -> None:
    """Execute a single hook with its own LLM call (individual agent mode)."""
    max_ctx = hook.context_messages
    recent_msgs = branch_msgs[-max_ctx:] if max_ctx > 0 else []

    conversation_text = "\n".join(
        f"{'用户' if m.role == 'user' else 'AI'}: {m.content}"
        for m in recent_msgs
        if m.role in ("user", "assistant")
    )

    state_text = ""
    if hook.include_state and state:
        state_text = _build_state_summary(state)

    system_prompt = (
        f"你是一个执行特定分析任务的助手。\n"
        f"任务：{hook.prompt}\n"
        f"请严格返回以下格式的结果（{hook.response_schema or '字符串'}），"
        f"不要添加任何 markdown 格式或额外说明。"
    )

    user_parts = []
    if state_text:
        user_parts.append(f"【当前状态】\n{state_text}")
    if conversation_text:
        user_parts.append(f"【最近对话】\n{conversation_text}")
    else:
        user_parts.append("（对话内容为空）")

    user_message = "\n\n".join(user_parts)

    effective_conn = hook.connection_id or connection_id

    try:
        raw_response = await chat_completion(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            connection_id=effective_conn,
        )
        log.info("hook_individual_called", session_id=session_id, hook_id=hook.id, hook_name=hook.name)
    except Exception:
        log.exception("hook_individual_llm_failed", session_id=session_id, hook_id=hook.id)
        return

    parsed = _extract_json(raw_response)
    result = parsed if parsed is not None else raw_response.strip()

    from app.models.schemas import WSMessageOut

    await push_fn(WSMessageOut(
        type="hook_result",
        data={
            "hook_id": hook.id,
            "hook_name": hook.name,
            "action": hook.action.model_dump(),
            "result": result,
        },
    ))
    log.debug("hook_individual_result_pushed", hook_id=hook.id, hook_name=hook.name)

    # Process after-hook callback
    await _process_after_hook_callback(hook, result, session_id, push_fn)


async def _process_after_hook_callback(
    hook: ChatHook,
    result: Any,
    session_id: str,
    push_fn,
) -> None:
    """Handle after-hook callback configuration."""
    cb = hook.after_hook_callback
    if not cb or cb.type == "none":
        return

    from app.models.schemas import WSMessageOut

    if cb.type == "send_message":
        # Auto-send the hook result as a chat message
        result_text = json.dumps(result, ensure_ascii=False) if not isinstance(result, str) else result
        if cb.payload_template:
            try:
                result_text = cb.payload_template.format(result=result_text)
            except Exception:
                pass
        await push_fn(WSMessageOut(
            type="hook_result",
            data={
                "hook_id": hook.id,
                "hook_name": f"{hook.name} (callback)",
                "action": {"type": "send_message", "panel_title": "", "script": ""},
                "result": result_text,
            },
        ))

    elif cb.type == "trigger_hook" and cb.target_hook_id:
        # Chain to another hook — push a special result that frontend can handle
        await push_fn(WSMessageOut(
            type="hook_result",
            data={
                "hook_id": hook.id,
                "hook_name": hook.name,
                "action": {
                    "type": "custom_script",
                    "panel_title": "",
                    "script": f"chain_hook('{cb.target_hook_id}', {json.dumps(result, ensure_ascii=False)})",
                },
                "result": result,
            },
        ))

    elif cb.type == "custom" and cb.condition:
        try:
            should_fire = _evaluate_condition(cb.condition, result)
            if should_fire:
                await push_fn(WSMessageOut(
                    type="hook_result",
                    data={
                        "hook_id": hook.id,
                        "hook_name": f"{hook.name} (callback)",
                        "action": {"type": "show_toast", "panel_title": "", "script": ""},
                        "result": f"Condition met: {cb.condition}",
                    },
                ))
        except Exception:
            log.warning("hook_callback_condition_failed", hook_id=hook.id, condition=cb.condition)


def _evaluate_condition(condition: str, result: Any) -> bool:
    """Evaluate a simple condition expression against a hook result."""
    import operator
    import re

    if not condition.strip():
        return True

    # Support simple expressions like "result.score > 0.8" or "result.status == 'done'"
    # For safety, use a restricted eval with limited builtins
    safe_globals = {
        "__builtins__": {
            "True": True, "False": False, "None": None,
            "int": int, "float": float, "str": str, "bool": bool,
            "len": len, "abs": abs, "min": min, "max": max,
        },
        "result": result if not isinstance(result, dict) else _dict_to_obj(result),
        "operator": operator,
    }

    try:
        return bool(eval(condition, safe_globals, {}))
    except Exception:
        return False


class _dict_to_obj:
    """Convert dict to object for dot-access in condition expressions."""

    def __init__(self, d: dict):
        for k, v in d.items():
            if isinstance(v, dict):
                setattr(self, k, _dict_to_obj(v))
            else:
                setattr(self, k, v)
