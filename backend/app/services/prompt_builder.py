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


def _format_relationship_metric_configs(metrics: list | object) -> list[str]:
    if not isinstance(metrics, list):
        return []

    lines: list[str] = []
    for metric in metrics:
        if not isinstance(metric, dict):
            metric = metric.model_dump() if hasattr(metric, "model_dump") else {}
        name = metric.get("name", "")
        if not name:
            continue
        min_value = metric.get("min_value", 0)
        max_value = metric.get("max_value", 100)
        initial_value = metric.get("initial_value", 0)
        description = metric.get("description", "")
        stage_parts = []
        for stage in metric.get("stages", []):
            if not isinstance(stage, dict):
                stage = stage.model_dump() if hasattr(stage, "model_dump") else {}
            label = stage.get("label", "")
            if not label:
                continue
            stage_parts.append(
                f"{stage.get('min', 0)}-{stage.get('max', 0)} {label}"
                + (f"（{stage.get('description')}）" if stage.get("description") else "")
            )
        line = f"- {name}: {min_value}-{max_value}, 初始{initial_value}"
        if description:
            line += f", {description}"
        if stage_parts:
            line += "; 阶段: " + " / ".join(stage_parts)
        lines.append(line)
    return lines


def _format_relationship_metric_states(characters: list) -> list[str]:
    lines: list[str] = []
    for char in characters:
        metrics = getattr(char, "relationship_metrics", [])
        if not metrics:
            continue
        metric_text = []
        for metric in metrics:
            stage = f"（{metric.stage}" + (f": {metric.stage_description}" if metric.stage_description else "") + "）" if metric.stage else ""
            note = f"，原因/备注: {metric.note}" if metric.note else ""
            metric_text.append(f"{metric.name} {metric.value}{stage}{note}")
        if metric_text:
            lines.append(f"- {char.name}: " + "; ".join(metric_text))
    return lines


async def build_chat_messages(
    system_prompt: str,
    state: StateData | None,
    summary: SummaryData | None,
    recent_messages: list[Message],
    user_input: str,
    characters: list | None = None,
    active_settings: list[dict] | None = None,
    user_protagonist: dict | None = None,
    narrator_directives: list[NarrativeDirective] | None = None,
    room_players: list | None = None,  # list of PlayerInfo dicts for multiplayer
    context_max_tokens_override: int | None = None,
) -> tuple[list[dict], dict]:
    """Build the OpenAI messages array with token budget management.

    Returns (messages, budget_info) where budget_info shows token allocation.
    """
    total_budget = context_max_tokens_override or settings.max_context_tokens
    # enforce a minimum workable budget to prevent broken prompts
    if total_budget < 2048:
        total_budget = 2048
    reserved = settings.reply_reserve_tokens

    # 1. System prompt
    if not system_prompt:
        system_prompt = await _load_template("system.txt")

    if settings.child_mode:
        safety_prefix = (
            "【内容安全 — 儿童模式已启用】\n"
            "你正在与儿童用户对话。严禁生成任何成人内容、暴力描写、性暗示、裸体、色情、血腥恐怖、自残自杀、"
            "毒品酒精滥用、仇恨言论或任何不适合未成年人的内容。如果对话中出现了上述违规内容的尝试或暗示，"
            "你必须拒绝继续该话题，仅回复：「抱歉，我无法进行相关对话。如需帮助，请切换至适当话题。」"
            "不要解释原因，不要展开描述。\n\n"
        )
        system_prompt = safety_prefix + system_prompt

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

    if active_settings:
        setting_parts = []
        for item in active_settings:
            name = item.get("name", "") if isinstance(item, dict) else getattr(item, "name", "")
            description = item.get("description", "") if isinstance(item, dict) else getattr(item, "description", "")
            content = item.get("content", "") if isinstance(item, dict) else getattr(item, "content", "")
            if not name and not content:
                continue
            block = f"【{name or '未命名设定'}】"
            if description:
                block += f"\n说明：{description}"
            if content:
                block += f"\n{content}"
            setting_parts.append(block)
        if setting_parts:
            system_prompt = (
                system_prompt
                + "\n\n【世界设定】以下设定已加入当前会话。请把它们视为稳定背景事实，除非后续对话明确改写或废弃：\n"
                + "\n\n".join(setting_parts)
            )

    # Append session characters / NPC cast to system prompt
    if characters:
        char_parts = []
        for c in characters:
            name = c.get("name", "") if isinstance(c, dict) else getattr(c, "name", "")
            setting = c.get("setting", "") if isinstance(c, dict) else getattr(c, "setting", "")
            relationship_metrics = c.get("relationship_metrics", []) if isinstance(c, dict) else getattr(c, "relationship_metrics", [])
            if name and (setting or relationship_metrics):
                char_line = f"- {name}: {setting}" if setting else f"- {name}"
                metric_lines = _format_relationship_metric_configs(relationship_metrics)
                if metric_lines:
                    char_line += "\n  关系字段:\n" + "\n".join(f"  {line}" for line in metric_lines)
                char_parts.append(char_line)
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
        if rpg.scene.location:
            away_chars = [
                c for c in rpg.characters
                if not c.is_protagonist and c.presence == "away" and c.location
            ]
            if away_chars:
                away_text = "; ".join(
                    f"{c.name}在{c.location}{('·' + c.sub_location) if c.sub_location else ''}"
                    for c in away_chars[:8]
                )
                parts.append(f"【不在当前场景】{away_text}")

        if rpg.explored_locations:
            visited = [loc.name for loc in rpg.explored_locations if loc.name]
            if visited:
                parts.append(f"【已到访地点】{', '.join(visited[-12:])}")

        relationship_lines = _format_relationship_metric_states(rpg.characters)
        if relationship_lines:
            parts.append("【角色关系阶段】\n" + "\n".join(relationship_lines))

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

    # 3. Narrator directives — placed at the END of the prompt (right before
    #    user input) for maximum weight. Built here for token accounting.
    narrator_text = ""
    narrator_tokens = 0
    narrator_max_tokens = getattr(settings, "narrator_max_tokens", 500)
    if narrator_directives:
        sorted_directives = sorted(narrator_directives, key=lambda d: d.priority, reverse=True)
        lines = [d.content for d in sorted_directives if d.content.strip()]
        if lines:
            numbered = "\n".join(f"{i+1}. {line}" for i, line in enumerate(lines))
            narrator_text = (
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                "【导演指令 — 本次回复中必须执行】\n"
                "在本次回复中呈现以下场景：\n\n"
                f"{numbered}\n\n"
                "执行要求：\n"
                "- 自然地融入当前场景，与前文无缝衔接，不要生硬转折\n"
                "- 通过环境描写、角色行为或对话自然引入，而非直接叙述\n"
                "- 本指令优先级高于其他风格指引\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            )
            narrator_tokens = count_tokens(narrator_text) + 4
            if narrator_tokens > narrator_max_tokens:
                narrator_text = narrator_text[: narrator_max_tokens * 3]
                narrator_tokens = count_tokens(narrator_text) + 4
            log.info("narrator_injected", directive_count=len(lines), tokens=narrator_tokens)
        else:
            log.debug("narrator_inject_empty_lines", directive_count=len(narrator_directives))
    else:
        log.debug("narrator_inject_no_directives")

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

    if summary_text:
        messages.append({"role": "system", "content": f"[过往聊天总结]\n{summary_text}"})

    if summary_text:
        messages.append({"role": "system", "content": transition})

    for msg in selected_messages:
        messages.append({"role": msg.role, "content": msg.content})

    # Narrator directives placed at the END — right before user input —
    # so the LLM gives them maximum weight when generating the response.
    if narrator_text:
        messages.append({"role": "user", "content": narrator_text})

    messages.append({"role": "user", "content": user_input})

    # In single-player mode, label the user message with their character name
    # (room mode already embeds [Name]: labels via build_combined_content)
    if user_protagonist and not room_players:
        pname = user_protagonist.get("name", "主角") if isinstance(user_protagonist, dict) else getattr(user_protagonist, "name", "主角")
        messages[-1] = {"role": "user", "content": f"[{pname}] {user_input}"}

    prompt_tokens = count_messages_tokens(messages)

    budget_info = {
        "total": total_budget,
        "prompt_tokens": prompt_tokens,
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
