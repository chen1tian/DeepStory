from __future__ import annotations

import json

import aiofiles
import structlog

from app.config import settings
from app.models.schemas import Message, SummaryData, StateData, RPGStateDelta, StateChangeEvent
from app.services.llm_service import chat_completion
from app.services.token_counter import count_tokens
from app.services.state_manager import get_state, apply_rpg_delta
from app.storage.file_storage import read_json, write_json

log = structlog.get_logger()

_template_cache: dict[str, str] = {}


async def _load_template(name: str) -> str:
    if name not in _template_cache:
        path = settings.prompts_dir / name
        async with aiofiles.open(path, "r", encoding="utf-8") as f:
            _template_cache[name] = await f.read()
    return _template_cache[name]


async def should_summarize(session_id: str, branch_messages: list[Message]) -> bool:
    """Check if we need to update the rolling summary.
    
    Summarize when the number of messages since last summary exceeds
    what the context window can hold raw.
    """
    summary_data = await _load_summary(session_id)
    unsummarized_count = len(branch_messages) - summary_data.last_summarized_index
    # Trigger summarization when we have more than 6 unsummarized message pairs
    return unsummarized_count >= 12


async def _load_summary(session_id: str) -> SummaryData:
    try:
        data = await read_json(session_id, "summary.json")
        if data is None:
            return SummaryData()
        return SummaryData(**data)
    except Exception:
        log.exception("summary_load_failed", session_id=session_id)
        return SummaryData()


async def incremental_summarize(session_id: str, branch_messages: list[Message], connection_id: str | None = None) -> SummaryData:
    """Perform incremental summarization: old summary + new messages → new summary."""
    summary = await _load_summary(session_id)

    new_msgs = branch_messages[summary.last_summarized_index:]
    if not new_msgs:
        return summary

    # Format new messages as text
    new_text = "\n".join(
        f"{'用户' if m.role == 'user' else '助手'}: {m.content}"
        for m in new_msgs
    )

    template = await _load_template("summarize.txt")
    prompt = template.format(
        previous_summary=summary.rolling_summary or "（这是对话的开始，没有之前的总结）",
        new_messages=new_text,
    )

    try:
        result = await chat_completion([
            {"role": "system", "content": "你是一个精确的文本总结助手。"},
            {"role": "user", "content": prompt},
        ], connection_id=connection_id)

        summary.rolling_summary = result
        summary.last_summarized_index = len(branch_messages)
        summary.token_count = count_tokens(result)

        await write_json(session_id, "summary.json", summary.model_dump())
        log.info("summary_updated", session_id=session_id, token_count=summary.token_count)
    except Exception:
        log.exception("summary_failed", session_id=session_id)

    return summary


async def extract_state(session_id: str, branch_messages: list[Message], connection_id: str | None = None) -> StateData:
    """Extract RPG state delta from recent messages and apply to full state."""
    try:
        current_state = await get_state(session_id)
    except Exception:
        log.exception("extract_state_load_failed", session_id=session_id)
        current_state = StateData()

    recent = branch_messages[-10:]
    if not recent:
        return current_state

    new_text = "\n".join(
        f"{'用户' if m.role == 'user' else '助手'}: {m.content}"
        for m in recent
    )

    # Build current state summary for context
    rpg = current_state.rpg
    session_data = await read_json(session_id, "session.json") or {}
    relationship_configs = [
        {
            "character": c.get("name", ""),
            "metrics": c.get("relationship_metrics", []),
        }
        for c in session_data.get("characters", [])
        if c.get("relationship_metrics")
    ]
    state_context = json.dumps({
        "characters": [{"name": c.name, "health": c.health, "injuries": c.injuries,
                        "status_effects": [e.name for e in c.status_effects],
                        "is_protagonist": c.is_protagonist,
                        "location": c.location,
                        "sub_location": c.sub_location,
                        "presence": c.presence,
                        "last_seen": c.last_seen,
                        "relationship_metrics": [m.model_dump() for m in c.relationship_metrics]}
                       for c in rpg.characters],
        "inventory": [{"name": i.name, "category": i.category, "quantity": i.quantity}
                      for i in rpg.inventory],
        "scene": {
            "location": rpg.scene.location,
            "sub_location": rpg.scene.sub_location,
            "time": rpg.scene.time,
            "weather": rpg.scene.weather,
            "atmosphere": rpg.scene.atmosphere,
            "danger_level": rpg.scene.danger_level,
            "objects": [obj.model_dump() for obj in rpg.scene.objects],
            "exits": [exit.model_dump() for exit in rpg.scene.exits],
            "npcs": [npc.model_dump() for npc in rpg.scene.npcs],
        },
        "explored_locations": [loc.model_dump() for loc in rpg.explored_locations],
        "relationship_metric_configs": relationship_configs,
        "active_quests": [{"name": q.name, "status": q.status} for q in rpg.quests if q.status == "active"],
    }, ensure_ascii=False, indent=2)

    template = await _load_template("extract_state.txt")
    prompt = template.format(
        previous_state=state_context,
        new_messages=new_text,
    )

    try:
        result = await chat_completion([
            {"role": "system", "content": "你是一个RPG游戏状态提取助手。只返回JSON，不要包含任何其他文本或markdown标记。"},
            {"role": "user", "content": prompt},
        ], connection_id=connection_id)

        result = result.strip()
        if result.startswith("```"):
            lines = result.split("\n")
            result = "\n".join(lines[1:-1])

        parsed = json.loads(result)
        delta = RPGStateDelta(**parsed)

        # Apply delta to full state
        updated_state = await apply_rpg_delta(session_id, delta)

        # Also update legacy fields for backward compat
        _sync_legacy_fields(updated_state)
        from app.services.state_manager import update_state
        await update_state(session_id, updated_state)

        log.info("rpg_state_extracted", session_id=session_id,
                 char_updates=len(delta.character_updates),
                 inv_changes=len(delta.inventory_changes),
                 events=len(delta.new_events))
        return updated_state
    except Exception:
        log.exception("state_extraction_failed", session_id=session_id)
        return current_state


def _sync_legacy_fields(state: StateData) -> None:
    """Keep old CharacterInfo/EventInfo/WorldState in sync for backward compat."""
    from app.models.schemas import CharacterInfo, EventInfo, WorldState
    rpg = state.rpg
    state.characters = [
        CharacterInfo(name=c.name, description=c.description,
                      status=f"HP:{c.health}/{c.max_health}" + (f" 伤:{','.join(c.injuries)}" if c.injuries else ""))
        for c in rpg.characters
    ]
    state.events = [
        EventInfo(description=e.description, timestamp=e.timestamp)
        for e in rpg.event_log[-5:]
    ]
    state.world_state = WorldState(
        location=rpg.scene.location,
        time=rpg.scene.time,
        atmosphere=rpg.scene.atmosphere,
        key_items=[i.name for i in rpg.inventory if i.category == "key_item"],
    )
    state.version = rpg.version
