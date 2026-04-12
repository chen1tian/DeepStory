from __future__ import annotations

from pathlib import Path

import aiofiles
import structlog

from app.config import settings
from app.models.schemas import Message, NarrativeDirective, SummaryData, StateData
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
    characters: list | None = None,
    user_protagonist: dict | None = None,
    narrator_directives: list[NarrativeDirective] | None = None,
    room_players: list | None = None,  # list of PlayerInfo dicts for multiplayer
) -> tuple[list[dict], dict]:
    """Build the OpenAI messages array with token budget management.
    
    Returns (messages, budget_info) where budget_info shows token allocation.
    """
    total_budget = settings.max_context_tokens
    reserved = settings.reply_reserve_tokens

    # 1. System prompt
    if not system_prompt:
        system_prompt = await _load_template("system.txt")

    # Append protagonist setting(s) to system prompt
    if room_players:
        # Multiplayer: inject each player's protagonist as a separate block
        protagonist_blocks = []
        for p in room_players:
            pname = p.get("protagonist_name", "") or p.get("username", "玩家")
            psetting = p.get("protagonist_setting", "")
            username = p.get("username", "")
            block = (
                f"【玩家主角 - {pname}】\n"
                f"玩家「{username}」正在扮演角色「{pname}」。"
                f"消息中 [{pname}] 标签的内容代表「{pname}」的行动与发言。"
            )
            if psetting:
                block += f"\n「{pname}」的角色背景与设定：\n{psetting}"
            protagonist_blocks.append(block)
        if protagonist_blocks:
            system_prompt = (
                system_prompt
                + "\n\n【多人扮演模式】\n"
                + "本次会话有多名玩家，每人扮演各自的角色。你是世界叙事者，"
                + "负责描述玩家行动后的世界反应，推动故事发展，不要替任何玩家角色主动行动。\n\n"
                + "\n\n".join(protagonist_blocks)
            )
    elif user_protagonist:
        # Single player: inject user protagonist block
        pname = user_protagonist.get("name", "主角") if isinstance(user_protagonist, dict) else getattr(user_protagonist, "name", "主角")
        psetting = user_protagonist.get("setting", "") if isinstance(user_protagonist, dict) else getattr(user_protagonist, "setting", "")
        protagonist_block = (
            f"【玩家主角 - {pname}】\n"
            f"用户正在扮演角色「{pname}」。用户发送的每一条消息，都代表「{pname}」的行动、话语或意图，请将其视为第一人称主角视角。\n"
            f"你的职责是世界叙事者：描述「{pname}」行动后的环境反应、NPC 对话与场景变化，推动故事发展。\n"
            f"重要原则：\n"
            f"- 「{pname}」是玩家操控的主角，不是 NPC，不要主动替玩家描写「{pname}」主动采取了哪些行动\n"
            f"- 等待用户描述「{pname}」做什么，然后再作出世界的反应\n"
            f"- 以第三人称叙述视角描述世界对「{pname}」行动的反馈"
        )
        if psetting:
            protagonist_block += f"\n\n「{pname}」的角色背景与设定：\n{psetting}"
        system_prompt = system_prompt + "\n\n" + protagonist_block

    # Append session characters / NPC cast to system prompt
    if characters:
        char_parts = []
        for c in characters:
            name = c.get("name", "") if isinstance(c, dict) else getattr(c, "name", "")
            setting = c.get("setting", "") if isinstance(c, dict) else getattr(c, "setting", "")
            if name and setting:
                char_parts.append(f"- {name}: {setting}")
        if char_parts:
            cast_header = "【演员表】以下角色是故事中的固定角色，请在合适的时机安排他们出场并保持其人设一致：\n"
            system_prompt = system_prompt + "\n\n" + cast_header + "\n".join(char_parts)

    sys_tokens = count_tokens(system_prompt) + 4

    # 2. State / background — use RPG summary (compact) for prompt injection
    state_text = ""
    state_tokens = 0
    if state:
        parts = []
        rpg_sum = state.rpg_summary
        # Always-inject compact RPG summary
        if rpg_sum.protagonist_summary:
            parts.append(f"【主角】{rpg_sum.protagonist_summary}")
        if rpg_sum.scene_summary:
            parts.append(f"【场景】{rpg_sum.scene_summary}")
        if rpg_sum.active_quest:
            parts.append(f"【任务】{rpg_sum.active_quest}")
        if rpg_sum.key_inventory:
            parts.append(f"【物品】{rpg_sum.key_inventory}")
        if rpg_sum.recent_events:
            parts.append(f"【近况】{rpg_sum.recent_events}")
        if rpg_sum.nearby_npcs:
            parts.append(f"【在场】{rpg_sum.nearby_npcs}")

        # Constraints from status effects and injuries
        rpg = state.rpg
        protagonist = next((c for c in rpg.characters if c.is_protagonist), None)
        if protagonist:
            constraints = []
            for eff in protagonist.status_effects:
                constraints.append(f"{eff.name}: {eff.impact}")
            for inj in protagonist.injuries:
                constraints.append(f"伤势 - {inj}")
            restricted_skills = [s for s in protagonist.skills if not s.available]
            for sk in restricted_skills:
                constraints.append(f"技能受限 - {sk.name}: {sk.restriction}")
            if constraints:
                parts.append(f"【行动约束】描写中必须体现: {'; '.join(constraints)}")

        # Fallback to legacy fields if no RPG data yet
        if not parts:
            if state.characters:
                parts.append("## 角色信息")
                for c in state.characters:
                    parts.append(f"- {c.name}: {c.description} (状态: {c.status})")
            if state.events:
                parts.append("## 近期事件")
                for e in state.events[-5:]:
                    parts.append(f"- {e.description}")
            ws = state.world_state
            if ws.location:
                parts.append(f"## 当前场景\n位置: {ws.location}, 时间: {ws.time}, 氛围: {ws.atmosphere}")
                if ws.key_items:
                    parts.append(f"重要物品: {', '.join(ws.key_items)}")

        if parts:
            state_text = "\n".join(parts)
            state_tokens = count_tokens(state_text) + 4
            if state_tokens > settings.state_max_tokens:
                state_text = state_text[: settings.state_max_tokens * 3]
                state_tokens = count_tokens(state_text) + 4

    # 3. Narrator directives
    narrator_text = ""
    narrator_tokens = 0
    narrator_max_tokens = getattr(settings, "narrator_max_tokens", 500)
    if narrator_directives:
        sorted_directives = sorted(narrator_directives, key=lambda d: d.priority, reverse=True)
        lines = [d.content for d in sorted_directives if d.content.strip()]
        if lines:
            narrator_text = "\n".join(f"- {line}" for line in lines)
            narrator_tokens = count_tokens(narrator_text) + 4
            if narrator_tokens > narrator_max_tokens:
                narrator_text = narrator_text[: narrator_max_tokens * 3]
                narrator_tokens = count_tokens(narrator_text) + 4

    # 4. Summary
    summary_text = ""
    summary_tokens = 0
    if summary and summary.rolling_summary:
        summary_text = summary.rolling_summary
        summary_tokens = count_tokens(summary_text) + 4
        if summary_tokens > settings.summary_max_tokens:
            summary_text = summary_text[: settings.summary_max_tokens * 3]
            summary_tokens = count_tokens(summary_text) + 4

    # 5. Transition prompt
    transition = "以上是之前的聊天总结，以下是最近的详细聊天记录。"
    transition_tokens = count_tokens(transition) + 4 if summary_text else 0

    # 6. User input
    user_tokens = count_tokens(user_input) + 4

    # 7. Remaining budget for recent messages
    used = sys_tokens + state_tokens + narrator_tokens + summary_tokens + transition_tokens + user_tokens + reserved
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

    if narrator_text:
        messages.append({"role": "system", "content": f"[叙事指导]\n{narrator_text}"})

    if summary_text:
        messages.append({"role": "system", "content": f"[过往聊天总结]\n{summary_text}"})

    if summary_text:
        messages.append({"role": "system", "content": transition})

    for msg in selected_messages:
        messages.append({"role": msg.role, "content": msg.content})

    messages.append({"role": "user", "content": user_input})

    # In single-player mode, label the user message with their character name
    # (room mode already embeds [Name]: labels via build_combined_content)
    if user_protagonist and not room_players:
        pname = user_protagonist.get("name", "主角") if isinstance(user_protagonist, dict) else getattr(user_protagonist, "name", "主角")
        messages[-1] = {"role": "user", "content": f"[{pname}] {user_input}"}

    budget_info = {
        "total": total_budget,
        "system_prompt": sys_tokens,
        "state": state_tokens,
        "narrator": narrator_tokens,
        "summary": summary_tokens,
        "messages": msg_tokens,
        "reserved": reserved,
        "remaining": remaining - msg_tokens,
    }

    log.info("prompt_built", budget=budget_info, msg_count=len(selected_messages))
    return messages, budget_info
