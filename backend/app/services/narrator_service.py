from __future__ import annotations

import json
import re
import uuid
from datetime import datetime
from typing import Any, AsyncIterator

import aiofiles
import structlog

from app.config import settings
from app.models.schemas import (
    Message,
    NarrativeDirective,
    NarratorArc,
    NarratorArcCollection,
    NarratorEvaluation,
    StateData,
    StoryNode,
)
from app.services.llm_service import chat_completion, chat_completion_stream
from app.storage.narrator_storage import load_narrator, save_narrator

log = structlog.get_logger()

_template_cache: dict[str, str] = {}


async def _load_template(name: str) -> str:
    if name not in _template_cache:
        path = settings.prompts_dir / name
        async with aiofiles.open(path, "r", encoding="utf-8") as f:
            _template_cache[name] = await f.read()
    return _template_cache[name]


def _extract_json(text: str) -> Any:
    """Robustly extract JSON from LLM response (handles markdown code blocks)."""
    import re

    # Strip markdown code fences
    cleaned = re.sub(r"```(?:json)?\s*", "", text).strip().rstrip("```").strip()

    # Try direct parse first
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Find first { ... } or [ ... ] block
    for pattern in (r"\{[\s\S]*\}", r"\[[\s\S]*\]"):
        m = re.search(pattern, cleaned)
        if m:
            try:
                return json.loads(m.group())
            except json.JSONDecodeError:
                continue

    raise ValueError(f"No valid JSON found in response: {text[:200]}")


async def load_arc(session_id: str) -> NarratorArc | None:
    data = await load_narrator(session_id)
    if data is None:
        return None
    if "current_arc" in data or "archived_arcs" in data:
        collection = NarratorArcCollection(**data)
        return collection.current_arc
    return NarratorArc(**data)


async def load_arc_collection(session_id: str) -> NarratorArcCollection:
    data = await load_narrator(session_id)
    if data is None:
        return NarratorArcCollection(session_id=session_id)
    if "current_arc" in data or "archived_arcs" in data:
        return NarratorArcCollection(**data)

    # Backward compatibility: old narrator.json stored a single arc directly.
    legacy_arc = NarratorArc(**data)
    return NarratorArcCollection(session_id=session_id, current_arc=legacy_arc)


async def save_arc(arc: NarratorArc) -> None:
    collection = await load_arc_collection(arc.session_id)
    collection.current_arc = arc
    await save_narrator(arc.session_id, collection.model_dump())


async def save_arc_collection(collection: NarratorArcCollection) -> None:
    await save_narrator(collection.session_id, collection.model_dump())


async def archive_current_arc(session_id: str) -> NarratorArcCollection:
    collection = await load_arc_collection(session_id)
    if collection.current_arc is None:
        return collection

    archived_arc = collection.current_arc.model_copy(update={
        "enabled": False,
        "archived_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
    })
    collection.archived_arcs = [archived_arc, *collection.archived_arcs]
    collection.current_arc = None
    await save_arc_collection(collection)
    return collection


def get_active_directives(arc: NarratorArc) -> list[NarrativeDirective]:
    """Return directives that are still active (not expired)."""
    return [
        d for d in arc.active_directives
        if d.turns_remaining is None or d.turns_remaining > 0
    ]


async def consume_directives(session_id: str) -> list[NarrativeDirective]:
    """
    Return active directives for prompt injection and consume one-shot / decrement limited ones.
    Saves the updated arc.
    """
    arc = await load_arc(session_id)
    if arc is None:
        log.debug("narrator_consume_no_arc", session_id=session_id)
        return []
    if not arc.enabled:
        log.debug("narrator_consume_disabled", session_id=session_id)
        return []

    active = get_active_directives(arc)
    if not active:
        log.debug("narrator_consume_empty", session_id=session_id)
        return []

    log.info("narrator_consume", session_id=session_id, directive_count=len(active),
             types=[d.type for d in active])

    # Process lifecycle
    remaining: list[NarrativeDirective] = []
    consumed_now: list[NarrativeDirective] = []

    for d in arc.active_directives:
        if d.persistent:
            remaining.append(d)
            continue
        if d.turns_remaining is not None:
            new_turns = d.turns_remaining - 1
            if new_turns > 0:
                remaining.append(d.model_copy(update={"turns_remaining": new_turns}))
            else:
                consumed_now.append(d.model_copy(update={
                    "turns_remaining": 0,
                    "consumed_at": datetime.now().isoformat(),
                }))
        else:
            # One-shot (not persistent, no turns_remaining) → consume
            consumed_now.append(d.model_copy(update={"consumed_at": datetime.now().isoformat()}))

    arc.active_directives = remaining
    arc.updated_at = datetime.now().isoformat()
    await save_arc(arc)

    return active


async def evaluate_and_direct(
    session_id: str,
    branch_msgs: list[Message],
    state: StateData | None,
    connection_id: str | None = None,
) -> dict:
    """
    Core narrator evaluation: assess story progress, update node statuses,
    and generate new narrative directives.

    Returns a summary dict suitable for pushing to the frontend.
    """
    arc = await load_arc(session_id)
    if arc is None or not arc.enabled:
        return {}

    system_prompt = await _load_template("narrator_evaluate.txt")

    # Build evaluation context
    context_parts: list[str] = []

    # Arc overview
    context_parts.append(f"【故事弧线目标】{arc.goal}")
    if arc.themes:
        context_parts.append(f"【主题】{', '.join(arc.themes)}")
    if arc.tone:
        context_parts.append(f"【基调】{arc.tone}")
    if arc.pacing_notes:
        context_parts.append(f"【节奏指导】{arc.pacing_notes}")
    context_parts.append(f"【当前紧张度】{arc.tension_level}/10")

    # Story nodes
    if arc.nodes:
        context_parts.append("\n【故事节点】")
        for node in sorted(arc.nodes, key=lambda n: n.order):
            context_parts.append(
                f"  [{node.id[:8]}] ({node.status}) {node.title}: {node.description}"
            )
            if node.conditions:
                context_parts.append(f"    触发条件: {node.conditions}")

    # Current active directives
    active = get_active_directives(arc)
    if active:
        context_parts.append("\n【当前活跃指令（避免重复生成类似内容）】")
        for d in active:
            context_parts.append(f"  [{d.type}] {d.content[:80]}")

    # State summary
    if state and state.rpg_summary:
        rpg = state.rpg_summary
        context_parts.append("\n【当前游戏状态】")
        if rpg.protagonist_summary:
            context_parts.append(f"主角: {rpg.protagonist_summary}")
        if rpg.scene_summary:
            context_parts.append(f"场景: {rpg.scene_summary}")
        if rpg.active_quest:
            context_parts.append(f"任务: {rpg.active_quest}")
        if rpg.recent_events:
            context_parts.append(f"近况: {rpg.recent_events}")

    # Recent conversation (last 8 messages)
    recent = branch_msgs[-8:]
    if recent:
        context_parts.append("\n【最近对话记录】")
        for msg in recent:
            role_label = "玩家" if msg.role == "user" else "AI叙事"
            context_parts.append(f"{role_label}: {msg.content[:300]}")

    user_content = "\n".join(context_parts)

    # Call LLM
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]
    try:
        raw = await chat_completion(messages, connection_id=connection_id)
        result = _extract_json(raw)
    except Exception as e:
        log.warning("narrator_eval_failed", session_id=session_id, error=str(e))
        return {}

    # Apply results to arc
    node_changes: list[dict] = []
    new_directive_ids: list[str] = []

    # Update node statuses
    node_updates = result.get("node_updates", [])
    for upd in node_updates:
        node_id_prefix = upd.get("node_id", "")
        new_status = upd.get("new_status", "")
        if not node_id_prefix or not new_status:
            continue
        for node in arc.nodes:
            if node.id.startswith(node_id_prefix) or node.id == node_id_prefix:
                old_status = node.status
                node.status = new_status
                node_changes.append({
                    "node_id": node.id,
                    "title": node.title,
                    "old_status": old_status,
                    "new_status": new_status,
                    "reason": upd.get("reason", ""),
                })
                # Auto-generate directives from node's template when it becomes active
                if new_status == "active" and node.directives_template:
                    for tmpl in node.directives_template[:2]:
                        d = NarrativeDirective(
                            id=str(uuid.uuid4()),
                            type="advance_quest",
                            content=tmpl,
                            priority=7,
                            persistent=False,
                            source_node_id=node.id,
                        )
                        arc.active_directives.append(d)
                        new_directive_ids.append(d.id)
                break

    # Add LLM-generated directives
    for raw_d in result.get("new_directives", []):
        content = raw_d.get("content", "").strip()
        if not content:
            continue
        d = NarrativeDirective(
            id=str(uuid.uuid4()),
            type=raw_d.get("type", "custom"),
            content=content,
            priority=int(raw_d.get("priority", 5)),
            persistent=bool(raw_d.get("persistent", False)),
            turns_remaining=raw_d.get("turns_remaining"),
        )
        arc.active_directives.append(d)
        new_directive_ids.append(d.id)

    # Adjust tension level
    tension_adj = int(result.get("tension_adjustment", 0))
    arc.tension_level = max(0, min(10, arc.tension_level + tension_adj))

    # Append evaluation log (keep last 10)
    turn = state.rpg.turn_count if state else 0
    evaluation = NarratorEvaluation(
        turn=turn,
        summary=result.get("assessment", ""),
        node_changes=node_changes,
        new_directive_ids=new_directive_ids,
        tension_adjustment=tension_adj,
    )
    arc.evaluation_log = (arc.evaluation_log + [evaluation])[-10:]
    arc.updated_at = datetime.now().isoformat()

    await save_arc(arc)
    log.info(
        "narrator_evaluated",
        session_id=session_id,
        tension=arc.tension_level,
        node_changes=len(node_changes),
        new_directives=len(new_directive_ids),
    )

    return {
        "arc_id": arc.id,
        "assessment": evaluation.summary,
        "tension_level": arc.tension_level,
        "tension_adjustment": tension_adj,
        "node_changes": node_changes,
        "new_directive_ids": new_directive_ids,
        "active_directives_count": len(get_active_directives(arc)),
    }


async def seed_initial_directives(session_id: str) -> None:
    """Activate the first pending node and seed directives from its template.

    Called synchronously when an arc is created or toggled on, so the first
    chat message already has narrative guidance injected.
    """
    arc = await load_arc(session_id)
    if arc is None or not arc.enabled:
        return

    if get_active_directives(arc):
        return  # Already has directives

    pending = sorted([n for n in arc.nodes if n.status == "pending"], key=lambda n: n.order)
    if not pending:
        return

    first = pending[0]
    first.status = "active"
    arc.updated_at = datetime.now().isoformat()

    # Use node's directives_template if available, otherwise generate a basic
    # directive from the node's title and description so guidance is never empty.
    templates = first.directives_template
    if not templates:
        desc = first.description or first.title
        templates = [f"开始推进故事节点「{first.title}」：{desc}"]

    for tmpl in templates[:2]:
        arc.active_directives.append(NarrativeDirective(
            id=str(uuid.uuid4()),
            type="advance_quest",
            content=tmpl,
            priority=7,
            persistent=False,
            source_node_id=first.id,
        ))

    await save_arc(arc)
    log.info("narrator_seeded", session_id=session_id, node=first.title,
             directive_count=min(len(templates), 2))


async def generate_nodes_with_ai(
    goal: str,
    count: int = 5,
    context: str = "",
    connection_id: str | None = None,
) -> list[dict]:
    """Use LLM to generate a list of story nodes for the given goal."""
    messages = await _build_generate_nodes_messages(goal=goal, count=count, context=context)

    raw = await chat_completion(messages, connection_id=connection_id)
    return _normalize_generated_nodes(raw)


async def _build_generate_nodes_messages(goal: str, count: int, context: str) -> list[dict[str, str]]:
    system_prompt = await _load_template("narrator_generate.txt")

    user_content_parts = [f"故事目标：{goal}", f"需要生成的节点数量：{count}"]
    if context:
        user_content_parts.append(f"已有故事背景：{context}")

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": "\n".join(user_content_parts)},
    ]


def _normalize_generated_nodes(raw: str) -> list[dict[str, Any]]:
    nodes_data = _extract_json(raw)

    if not isinstance(nodes_data, list):
        raise ValueError("Expected a JSON array of story nodes")

    result = []
    for i, node in enumerate(nodes_data):
        result.append({
            "id": str(uuid.uuid4()),
            "title": node.get("title", f"节点{i+1}"),
            "description": node.get("description", ""),
            "conditions": node.get("conditions", ""),
            "order": node.get("order", i + 1),
            "directives_template": node.get("directives_template", []),
            "status": "pending",
            "created_at": datetime.now().isoformat(),
        })
    return result


async def generate_nodes_with_ai_stream(
    goal: str,
    count: int = 5,
    context: str = "",
    connection_id: str | None = None,
) -> AsyncIterator[dict[str, Any]]:
    """Stream narrator node generation events and finish with parsed nodes."""
    messages = await _build_generate_nodes_messages(goal=goal, count=count, context=context)
    yield {"type": "status", "message": "已发送生成请求，等待模型响应..."}

    raw_content_parts: list[str] = []
    received_any = False

    try:
        async for kind, text in chat_completion_stream(messages, connection_id=connection_id):
            if not text:
                continue
            received_any = True
            if kind == "thinking":
                yield {"type": "thinking", "content": text}
            else:
                raw_content_parts.append(text)
                yield {"type": "content", "content": text}

        if not received_any:
            yield {"type": "status", "message": "模型未返回可见内容，尝试解析空响应..."}

        raw = "".join(raw_content_parts)
        nodes = _normalize_generated_nodes(raw)
        yield {"type": "result", "nodes": nodes}
    except Exception as exc:
        yield {"type": "error", "message": str(exc)}
