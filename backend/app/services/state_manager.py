from __future__ import annotations

import json
import structlog

from app.models.schemas import (
    StateData, RPGStateData, RPGStateSummary, RPGStateDelta,
    RPGCharacter, InventoryItem, StateChangeEvent, MapLocation,
)
from app.storage.file_storage import read_json, write_json

log = structlog.get_logger()


async def get_state(session_id: str) -> StateData:
    try:
        data = await read_json(session_id, "state.json")
        if data is None:
            return StateData()
        return StateData(**data)
    except Exception:
        log.exception("state_load_failed", session_id=session_id)
        return StateData()


async def update_state(session_id: str, state: StateData) -> None:
    await write_json(session_id, "state.json", state.model_dump())


async def apply_rpg_delta(session_id: str, delta: RPGStateDelta) -> StateData:
    """Apply incremental changes (delta) to the full RPG state."""
    state = await get_state(session_id)
    rpg = state.rpg

    rpg.turn_count += 1

    # 1. Character updates
    char_by_name = {c.name: c for c in rpg.characters}
    for upd in delta.character_updates:
        name = upd.get("name", "")
        if not name:
            continue
        if name in char_by_name:
            char = char_by_name[name]
            for k, v in upd.items():
                if k == "name":
                    continue
                if k == "status_effects" and isinstance(v, list):
                    from app.models.schemas import StatusEffect
                    converted = []
                    for e in v:
                        if isinstance(e, StatusEffect):
                            converted.append(e)
                        elif isinstance(e, dict):
                            converted.append(StatusEffect(**e))
                        else:
                            converted.append(StatusEffect(name=str(e)))
                    char.status_effects = converted
                elif k == "injuries" and isinstance(v, list):
                    char.injuries = v
                elif k == "relationships" and isinstance(v, list):
                    from app.models.schemas import Relationship
                    converted = []
                    for r in v:
                        if isinstance(r, Relationship):
                            converted.append(r)
                        elif isinstance(r, dict):
                            converted.append(Relationship(**r))
                    char.relationships = converted
                elif k == "tags" and isinstance(v, list):
                    for tag in v:
                        if tag not in char.tags:
                            char.tags.append(tag)
                elif hasattr(char, k):
                    setattr(char, k, v)
        else:
            # New character
            rpg.characters.append(RPGCharacter(**upd))

    # 2. Inventory changes
    inv_by_name = {item.name: item for item in rpg.inventory}
    for change in delta.inventory_changes:
        action = change.get("action", "add")
        item_name = change.get("name", "")
        if not item_name:
            continue
        if action == "add":
            if item_name in inv_by_name:
                inv_by_name[item_name].quantity += change.get("quantity", 1)
            else:
                new_item = InventoryItem(
                    name=item_name,
                    category=change.get("category", ""),
                    description=change.get("description", ""),
                    quantity=change.get("quantity", 1),
                    effect=change.get("effect", ""),
                    related_quest=change.get("related_quest", ""),
                )
                rpg.inventory.append(new_item)
                inv_by_name[item_name] = new_item
        elif action == "remove" or action == "use":
            if item_name in inv_by_name:
                qty = change.get("quantity", 1)
                inv_by_name[item_name].quantity -= qty
                if inv_by_name[item_name].quantity <= 0:
                    rpg.inventory = [i for i in rpg.inventory if i.name != item_name]
                    del inv_by_name[item_name]
        elif action == "update":
            if item_name in inv_by_name:
                for k, v in change.items():
                    if k in ("action", "name"):
                        continue
                    if hasattr(inv_by_name[item_name], k):
                        setattr(inv_by_name[item_name], k, v)

    # 3. Scene changes
    if delta.scene_changes:
        scene = rpg.scene
        for k, v in delta.scene_changes.items():
            if k == "objects" and isinstance(v, list):
                from app.models.schemas import SceneObject
                converted = []
                for o in v:
                    if isinstance(o, SceneObject):
                        converted.append(o)
                    elif isinstance(o, dict):
                        converted.append(SceneObject(**o))
                    elif isinstance(o, str):
                        converted.append(SceneObject(name=o))
                scene.objects = converted
            elif k == "exits" and isinstance(v, list):
                from app.models.schemas import SceneExit
                converted = []
                for e in v:
                    if isinstance(e, SceneExit):
                        converted.append(e)
                    elif isinstance(e, dict):
                        converted.append(SceneExit(**e))
                scene.exits = converted
            elif k == "npcs" and isinstance(v, list):
                from app.models.schemas import SceneNPC
                converted = []
                for n in v:
                    if isinstance(n, SceneNPC):
                        converted.append(n)
                    elif isinstance(n, dict):
                        converted.append(SceneNPC(**n))
                    elif isinstance(n, str):
                        converted.append(SceneNPC(name=n))
                scene.npcs = converted
            elif hasattr(scene, k):
                setattr(scene, k, v)
        # Track explored location
        if scene.location:
            known = {loc.name for loc in rpg.explored_locations}
            if scene.location not in known:
                from datetime import datetime
                rpg.explored_locations.append(MapLocation(
                    name=scene.location,
                    discovered_at=datetime.now().isoformat(),
                ))

    # 4. Quest updates
    quest_by_name = {q.name: q for q in rpg.quests}
    for qupd in delta.quest_updates:
        qname = qupd.get("name", "")
        if not qname:
            continue
        if qname in quest_by_name:
            for k, v in qupd.items():
                if k == "name":
                    continue
                if hasattr(quest_by_name[qname], k):
                    setattr(quest_by_name[qname], k, v)
        else:
            from app.models.schemas import QuestInfo
            rpg.quests.append(QuestInfo(**qupd))

    # 5. Event log (keep last 20)
    for evt in delta.new_events:
        evt.turn = rpg.turn_count
        rpg.event_log.append(evt)
    if len(rpg.event_log) > 20:
        rpg.event_log = rpg.event_log[-20:]

    # 6. Update region connections from scene exits
    if rpg.scene.location and rpg.scene.exits:
        neighbors = [e.destination for e in rpg.scene.exits if e.destination]
        if neighbors:
            rpg.region_connections[rpg.scene.location] = neighbors

    rpg.version += 1
    state.rpg = rpg

    # 7. Generate summary
    state.rpg_summary = build_rpg_summary(rpg)

    await update_state(session_id, state)
    log.info("rpg_state_updated", session_id=session_id, version=rpg.version, turn=rpg.turn_count)
    return state


def build_rpg_summary(rpg: RPGStateData) -> RPGStateSummary:
    """Build a compact text summary of RPG state for prompt injection."""
    summary = RPGStateSummary()

    # Protagonist summary
    protagonist = next((c for c in rpg.characters if c.is_protagonist), None)
    if protagonist:
        parts = [protagonist.name]
        parts.append(f"体力{protagonist.health}/{protagonist.max_health}")
        if protagonist.injuries:
            parts.append(f"伤势: {', '.join(protagonist.injuries)}")
        if protagonist.status_effects:
            effs = [f"{e.name}({e.impact})" for e in protagonist.status_effects]
            parts.append(f"状态: {', '.join(effs)}")
        if protagonist.mood:
            parts.append(f"情绪: {protagonist.mood}")
        summary.protagonist_summary = "，".join(parts)

    # Scene summary
    sc = rpg.scene
    if sc.location:
        parts = [sc.location]
        if sc.sub_location:
            parts[0] += f"·{sc.sub_location}"
        if sc.time:
            parts.append(sc.time)
        if sc.weather:
            parts.append(sc.weather)
        if sc.atmosphere:
            parts.append(sc.atmosphere)
        if sc.danger_level:
            parts.append(f"危险等级: {sc.danger_level}")
        summary.scene_summary = "，".join(parts)

    # Active quest
    active_quests = [q for q in rpg.quests if q.status == "active"]
    if active_quests:
        main = next((q for q in active_quests if q.type == "main"), active_quests[0])
        summary.active_quest = f"{main.name}: {main.objective}" + (f" ({main.progress})" if main.progress else "")

    # Key inventory (compact)
    if rpg.inventory:
        key_items = [i for i in rpg.inventory if i.category == "key_item"]
        equips = [i for i in rpg.inventory if i.category == "equipment"]
        consumables = [i for i in rpg.inventory if i.category == "consumable"]
        parts = []
        for i in equips[:3]:
            parts.append(i.name)
        for i in consumables[:3]:
            parts.append(f"{i.name}×{i.quantity}" if i.quantity > 1 else i.name)
        for i in key_items:
            parts.append(f"[关键]{i.name}")
        summary.key_inventory = "携带: " + ", ".join(parts) if parts else ""

    # Recent events (last 3)
    if rpg.event_log:
        recent = rpg.event_log[-3:]
        summary.recent_events = "; ".join(e.description for e in recent)

    # Nearby NPCs
    if sc.npcs:
        npc_strs = [f"{n.name}({n.attitude})" if n.attitude else n.name for n in sc.npcs]
        summary.nearby_npcs = "在场: " + ", ".join(npc_strs)

    return summary


# ─────────────────────────────────────────────────────────────
# ASCII terrain map generation (30x30, cached per location)
# ─────────────────────────────────────────────────────────────

import hashlib  # noqa: E402


def _location_map_key(location: str, exits: list[str]) -> str:
    """Cache key: location name + sorted exits.
    只有当该地点的出口变化时（新发现通路），才重新生成地形图。
    """
    content = (location or "") + "|" + ",".join(sorted(set(exits)))
    return hashlib.md5(content.encode("utf-8")).hexdigest()[:12]


def _load_map_cache(session_id: str):
    """Load the map cache dict. Returns {"maps": {...}} or empty dict."""
    import json
    from pathlib import Path
    from app.storage.file_storage import _session_dir
    path = _session_dir(session_id) / "map_cache.json"
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


async def _save_map_cache(session_id: str, cache: dict):
    """Persist the map cache dict."""
    from app.storage.file_storage import write_json as _wj
    await _wj(session_id, "map_cache.json", cache)


async def get_cached_map(session_id: str) -> dict | None:
    """Return the full map_cache.json content or None."""
    cache = _load_map_cache(session_id)
    return cache if cache else None


def _build_terrain_prompt(
    location: str,
    exits: list[str],
    explored: list[str],
) -> str:
    """Build the LLM prompt for a terrain map of a specific location."""
    exit_lines: list[str] = []
    if exits:
        directions = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"]
        for i, dest in enumerate(exits):
            d = directions[i % len(directions)]
            exit_lines.append(f"  {d}侧 → {dest}")
    exit_text = "\n".join(exit_lines) if exit_lines else "  （暂无已知出口）"

    other_locs = [l for l in explored if l != location]
    other_text = "、".join(other_locs) if other_locs else "（暂无）"

    return (
        f"请为RPG场景「{location}」绘制一幅30x30的字符地形图。\n\n"
        f"已探索的其他地点：{other_text}\n\n"
        f"从本地图可以前往的地点（出口）：\n{exit_text}\n\n"
        "地形符号参考：\n"
        "  ≈ ~  水域（河流、湖泊、海岸）\n"
        "  . ·  草地 / 平原\n"
        "  ^  森林 / 密林\n"
        "  # ▲  山峦 / 岩石 / 高地\n"
        "  ,  沙地 / 沙滩 / 荒漠\n"
        "  = ≡  道路 / 石板路\n"
        "  @  建筑 / 房屋 / 城镇中心\n"
        "  *  树木 / 灌木 / 特殊标志物\n"
        "  +  栅栏 / 围墙\n"
        "  %  沼泽 / 湿地\n\n"
        "标记规则（重要）：\n"
        f"1. 玩家当前位置用 ★ 标记，放在场景合理的入口位置\n"
        "2. 出口统一标记为 ◆[地点名]，放置在对应方向的边界上\n"
        "3. 地图四周用合适的边界字符（~ = # 等）围起来\n"
        "4. 地形过渡要自然，不要出现突兀的变化\n"
        "5. 适当添加装饰性地形，让地图丰富有层次\n"
        "6. 地图宽度不超过30列，高度不超过30行\n"
        "7. 只输出地图本身，不要任何额外说明、标题或markdown标记"
    )


async def generate_ascii_map(
    session_id: str,
    location: str,
    connections: dict[str, list[str]],
    explored: list[str],
    connection_id: str | None = None,
) -> dict:
    """Generate (or return cached) 80x80 terrain map for the current location.
    每个地点一张地形图，缓存在 map_cache.json 中。
    再次进入同一地点直接返回缓存，不重新生成。
    """
    from app.services.llm_service import chat_completion

    exits = connections.get(location, [])
    map_key = _location_map_key(location, exits)

    cache = _load_map_cache(session_id)
    maps = cache.get("maps", {}) if isinstance(cache, dict) else {}

    # Cache hit — same location, same exits
    if map_key in maps:
        return {"cache_key": map_key, "ascii_map": maps[map_key]}

    # Generate new terrain map for this location
    prompt = _build_terrain_prompt(location, exits, explored)

    try:
        result = await chat_completion(
            [
                {
                    "role": "system",
                    "content": (
                        "你是RPG字符地形图生成器。只返回地图本身，不含任何说明文字或markdown标记。"
                        "地形分布要合理自然，边界完整。"
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            connection_id=connection_id,
        )
        ascii_map = result.strip("\n\r")
        if ascii_map.strip().startswith("```"):
            ascii_map = ascii_map.strip()
            lines = ascii_map.split("\n")
            end = -1 if lines[-1].strip() == "```" else len(lines)
            ascii_map = "\n".join(lines[1:end]).strip("\n\r")
    except Exception:
        log.exception("map_generation_failed", session_id=session_id)
        ascii_map = _fallback_map(location, explored, connections)

    # Ensure cache dict structure
    if "maps" not in cache or not isinstance(cache.get("maps"), dict):
        cache = {"maps": {}}
    cache["maps"][map_key] = ascii_map
    await _save_map_cache(session_id, cache)
    return {"cache_key": map_key, "ascii_map": ascii_map}


def _fallback_map(
    location: str, explored: list[str], connections: dict[str, list[str]]
) -> str:
    """Simple text fallback when LLM generation fails."""
    exits = connections.get(location, [])
    lines = [f"~~~ {location} ~~~", ""]
    lines.append("地形: 未知（地图生成失败）")
    lines.append(f"★ 当前位置: {location}")
    if exits:
        for e in exits:
            lines.append(f"◆[{e}]")
    return "\n".join(lines)
