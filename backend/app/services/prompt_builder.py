from __future__ import annotations

from pathlib import Path

import aiofiles
import structlog

from app.config import settings
from app.models.schemas import Message, SummaryData, StateData
from app.services.token_counter import count_tokens, count_messages_tokens

log = structlog.get_logger()

_template_cache: dict[str, str] = {}


async def _load_template(name: str) -> str:
    if name not in _template_cache:
        path = settings.prompts_dir / name
        async with aiofiles.open(path, "r", encoding="utf-8") as f:
            _template_cache[name] = await f.read()
    return _template_cache[name]


async def build_chat_messages(
    system_prompt: str,
    state: StateData | None,
    summary: SummaryData | None,
    recent_messages: list[Message],
    user_input: str,
) -> tuple[list[dict], dict]:
    """Build the OpenAI messages array with token budget management.
    
    Returns (messages, budget_info) where budget_info shows token allocation.
    """
    total_budget = settings.max_context_tokens
    reserved = settings.reply_reserve_tokens

    # 1. System prompt
    if not system_prompt:
        system_prompt = await _load_template("system.txt")
    sys_tokens = count_tokens(system_prompt) + 4

    # 2. State / background
    state_text = ""
    state_tokens = 0
    if state and (state.characters or state.events or state.world_state.location):
        parts = []
        if state.characters:
            parts.append("## 角色信息")
            for c in state.characters:
                parts.append(f"- {c.name}: {c.description} (状态: {c.status})")
        if state.events:
            parts.append("## 近期事件")
            for e in state.events[-5:]:  # last 5 events
                parts.append(f"- {e.description}")
        ws = state.world_state
        if ws.location:
            parts.append(f"## 当前场景\n位置: {ws.location}, 时间: {ws.time}, 氛围: {ws.atmosphere}")
            if ws.key_items:
                parts.append(f"重要物品: {', '.join(ws.key_items)}")
        state_text = "\n".join(parts)
        state_tokens = count_tokens(state_text) + 4
        # Cap state tokens
        if state_tokens > settings.state_max_tokens:
            state_text = state_text[: settings.state_max_tokens * 3]  # rough char trim
            state_tokens = count_tokens(state_text) + 4

    # 3. Summary
    summary_text = ""
    summary_tokens = 0
    if summary and summary.rolling_summary:
        summary_text = summary.rolling_summary
        summary_tokens = count_tokens(summary_text) + 4
        if summary_tokens > settings.summary_max_tokens:
            summary_text = summary_text[: settings.summary_max_tokens * 3]
            summary_tokens = count_tokens(summary_text) + 4

    # 4. Transition prompt
    transition = "以上是之前的聊天总结，以下是最近的详细聊天记录。"
    transition_tokens = count_tokens(transition) + 4 if summary_text else 0

    # 5. User input
    user_tokens = count_tokens(user_input) + 4

    # 6. Remaining budget for recent messages
    used = sys_tokens + state_tokens + summary_tokens + transition_tokens + user_tokens + reserved
    remaining = total_budget - used

    # Fill recent messages from newest to oldest
    selected_messages: list[Message] = []
    msg_tokens = 0
    for msg in reversed(recent_messages):
        mt = count_tokens(msg.content) + 4
        if msg_tokens + mt > remaining:
            break
        selected_messages.insert(0, msg)
        msg_tokens += mt

    # Build final messages array
    messages: list[dict] = [{"role": "system", "content": system_prompt}]

    if state_text:
        messages.append({"role": "system", "content": f"[背景资料]\n{state_text}"})

    if summary_text:
        messages.append({"role": "system", "content": f"[过往聊天总结]\n{summary_text}"})

    if summary_text:
        messages.append({"role": "system", "content": transition})

    for msg in selected_messages:
        messages.append({"role": msg.role, "content": msg.content})

    messages.append({"role": "user", "content": user_input})

    budget_info = {
        "total": total_budget,
        "system_prompt": sys_tokens,
        "state": state_tokens,
        "summary": summary_tokens,
        "messages": msg_tokens,
        "reserved": reserved,
        "remaining": remaining - msg_tokens,
    }

    log.info("prompt_built", budget=budget_info, msg_count=len(selected_messages))
    return messages, budget_info
