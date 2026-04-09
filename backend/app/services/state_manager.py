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
    data = await read_json(session_id, "state.json")
    if data is None:
        return StateData()
    return StateData(**data)


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
                    char.status_effects = [StatusEffect(**e) if isinstance(e, dict) else e for e in v]
                elif k == "injuries" and isinstance(v, list):
                    char.injuries = v
                elif k == "relationships" and isinstance(v, list):
                    from app.models.schemas import Relationship
                    char.relationships = [Relationship(**r) if isinstance(r, dict) else r for r in v]
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
                scene.objects = [SceneObject(**o) if isinstance(o, dict) else o for o in v]
            elif k == "exits" and isinstance(v, list):
                from app.models.schemas import SceneExit
                scene.exits = [SceneExit(**e) if isinstance(e, dict) else e for e in v]
            elif k == "npcs" and isinstance(v, list):
                from app.models.schemas import SceneNPC
                scene.npcs = [SceneNPC(**n) if isinstance(n, dict) else n for n in v]
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
