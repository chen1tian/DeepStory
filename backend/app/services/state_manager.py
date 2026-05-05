from __future__ import annotations

import json
import random
import structlog
from datetime import datetime

from app.models.schemas import (
    StateData, RPGStateData, RPGStateSummary, RPGStateDelta,
    RPGCharacter, InventoryItem, StateChangeEvent, MapLocation,
    RelationshipMetricConfig, RelationshipMetricState,
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
    previous_location = rpg.scene.location or ""
    now = datetime.now().isoformat()
    relationship_configs = await _load_relationship_metric_configs(session_id)
    _ensure_relationship_metric_states(rpg, relationship_configs, now)

    # 1. Character updates
    char_by_name = {c.name: c for c in rpg.characters}
    for upd in delta.character_updates:
        name = upd.get("name", "")
        if not name:
            continue
        metric_updates = upd.get("relationship_metrics", [])
        if name in char_by_name:
            char = char_by_name[name]
            for k, v in upd.items():
                if k == "name":
                    continue
                if k == "relationship_metrics":
                    _apply_relationship_metric_updates(
                        char,
                        v,
                        relationship_configs.get(name, []),
                        now,
                    )
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
            new_data = {k: v for k, v in upd.items() if k != "relationship_metrics"}
            rpg.characters.append(RPGCharacter(**new_data))
            char_by_name[name] = rpg.characters[-1]
            _ensure_character_metric_states(char_by_name[name], relationship_configs.get(name, []), now)
            _apply_relationship_metric_updates(
                char_by_name[name],
                metric_updates,
                relationship_configs.get(name, []),
                now,
            )

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
    scene_npcs_was_provided = "npcs" in delta.scene_changes
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
            _mark_location_visited(rpg, scene.location, now)
            if scene.location != previous_location and not scene_npcs_was_provided:
                scene.npcs = []

    _sync_character_presence(
        rpg=rpg,
        previous_location=previous_location,
        scene_npcs_was_provided=scene_npcs_was_provided,
        timestamp=now,
    )

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


async def _load_relationship_metric_configs(session_id: str) -> dict[str, list[RelationshipMetricConfig]]:
    data = await read_json(session_id, "session.json")
    if not data:
        return {}

    configs: dict[str, list[RelationshipMetricConfig]] = {}
    for char in data.get("characters", []):
        name = char.get("name", "")
        if not name:
            continue
        raw_metrics = char.get("relationship_metrics", [])
        metrics = []
        for raw in raw_metrics:
            try:
                metrics.append(RelationshipMetricConfig(**raw))
            except Exception:
                log.warning("relationship_metric_config_invalid", session_id=session_id, character=name)
        if metrics:
            configs[name] = metrics
    return configs


def _ensure_relationship_metric_states(
    rpg: RPGStateData,
    configs: dict[str, list[RelationshipMetricConfig]],
    timestamp: str,
) -> None:
    char_by_name = {char.name: char for char in rpg.characters}
    for char_name, metric_configs in configs.items():
        char = char_by_name.get(char_name)
        if char is None:
            char = RPGCharacter(name=char_name)
            rpg.characters.append(char)
            char_by_name[char_name] = char
        _ensure_character_metric_states(char, metric_configs, timestamp)


def _ensure_character_metric_states(
    char: RPGCharacter,
    metric_configs: list[RelationshipMetricConfig],
    timestamp: str,
) -> None:
    metric_by_name = {metric.name: metric for metric in char.relationship_metrics}
    for config in metric_configs:
        if not config.name:
            continue
        existing = metric_by_name.get(config.name)
        if existing is None:
            value = _clamp(config.initial_value, config.min_value, config.max_value)
            stage, stage_description = _resolve_relationship_stage(config, value)
            char.relationship_metrics.append(RelationshipMetricState(
                name=config.name,
                value=value,
                stage=stage,
                stage_description=stage_description,
                last_changed=timestamp,
            ))
        else:
            existing.value = _clamp(existing.value, config.min_value, config.max_value)
            existing.stage, existing.stage_description = _resolve_relationship_stage(config, existing.value)


def _apply_relationship_metric_updates(
    char: RPGCharacter,
    updates: list[dict] | object,
    metric_configs: list[RelationshipMetricConfig],
    timestamp: str,
) -> None:
    if not isinstance(updates, list):
        return

    config_by_name = {config.name: config for config in metric_configs}
    metric_by_name = {metric.name: metric for metric in char.relationship_metrics}

    for update in updates:
        if not isinstance(update, dict):
            continue
        name = update.get("name", "")
        if not name:
            continue
        config = config_by_name.get(name, RelationshipMetricConfig(name=name))
        metric = metric_by_name.get(name)
        if metric is None:
            value = _clamp(config.initial_value, config.min_value, config.max_value)
            stage, stage_description = _resolve_relationship_stage(config, value)
            metric = RelationshipMetricState(
                name=name,
                value=value,
                stage=stage,
                stage_description=stage_description,
            )
            char.relationship_metrics.append(metric)
            metric_by_name[name] = metric

        if "value" in update:
            try:
                next_value = int(update["value"])
            except (TypeError, ValueError):
                next_value = metric.value
        else:
            raw_delta = update.get("value_delta", update.get("delta", update.get("change", 0)))
            try:
                next_value = metric.value + int(raw_delta)
            except (TypeError, ValueError):
                next_value = metric.value

        metric.value = _clamp(next_value, config.min_value, config.max_value)
        metric.stage, metric.stage_description = _resolve_relationship_stage(config, metric.value)
        metric.note = update.get("note") or update.get("reason") or metric.note
        metric.last_changed = timestamp


def _resolve_relationship_stage(config: RelationshipMetricConfig, value: int) -> tuple[str, str]:
    for stage in config.stages:
        if stage.min <= value <= stage.max:
            return stage.label, stage.description
    return "", ""


def _clamp(value: int, min_value: int, max_value: int) -> int:
    return max(min_value, min(max_value, value))


def _mark_location_visited(rpg: RPGStateData, location: str, timestamp: str) -> None:
    loc = next((item for item in rpg.explored_locations if item.name == location), None)
    if loc is None:
        rpg.explored_locations.append(MapLocation(
            name=location,
            discovered_at=timestamp,
            last_visited=timestamp,
            visit_count=1,
        ))
        return

    loc.last_visited = timestamp
    loc.visit_count = max(1, loc.visit_count + 1)


def _sync_character_presence(
    rpg: RPGStateData,
    previous_location: str,
    scene_npcs_was_provided: bool,
    timestamp: str,
) -> None:
    current_location = rpg.scene.location or ""
    current_sub_location = rpg.scene.sub_location or ""
    if not current_location:
        return

    present_names = {npc.name for npc in rpg.scene.npcs if npc.name}
    char_by_name = {char.name: char for char in rpg.characters}

    for npc in rpg.scene.npcs:
        if not npc.name:
            continue
        npc.location = current_location
        char = char_by_name.get(npc.name)
        if char is None:
            char = RPGCharacter(
                name=npc.name,
                location=current_location,
                sub_location=current_sub_location,
                presence="present",
                last_seen=timestamp,
            )
            rpg.characters.append(char)
            char_by_name[npc.name] = char
            continue

        char.location = current_location
        char.sub_location = current_sub_location
        char.presence = "present"
        char.last_seen = timestamp

    for char in rpg.characters:
        if char.is_protagonist:
            char.location = current_location
            char.sub_location = current_sub_location
            char.presence = "present"
            char.last_seen = timestamp
            continue

        if char.name in present_names:
            continue

        if scene_npcs_was_provided:
            if char.presence == "present" or (
                previous_location and char.location in ("", previous_location, current_location)
            ):
                char.presence = "away"
                if not char.location or char.location == current_location:
                    char.location = previous_location or current_location
                char.last_seen = char.last_seen or timestamp


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
# ASCII terrain map generation (30x30, cached once per location)
# ─────────────────────────────────────────────────────────────

import hashlib  # noqa: E402


MAP_STYLE_VERSION = "roguelike-v2"
ROGUELIKE_WIDTH = 30
ROGUELIKE_HEIGHT = 20
_EXIT_DIRECTIONS = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"]


def _location_map_key(location: str) -> str:
    """Cache key: map style version + location name.
    同一地点只生成一次；再次进入时直接读取已缓存地图。
    """
    content = MAP_STYLE_VERSION + "|" + (location or "")
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


def _seeded_rng(location: str) -> random.Random:
    seed_material = MAP_STYLE_VERSION + "|" + (location or "")
    seed = int(hashlib.sha256(seed_material.encode("utf-8")).hexdigest()[:16], 16)
    return random.Random(seed)


def _room_center(room: tuple[int, int, int, int]) -> tuple[int, int]:
    x1, y1, x2, y2 = room
    return ((x1 + x2) // 2, (y1 + y2) // 2)


def _rooms_overlap(
    room: tuple[int, int, int, int],
    others: list[tuple[int, int, int, int]],
    padding: int = 1,
) -> bool:
    x1, y1, x2, y2 = room
    for ox1, oy1, ox2, oy2 in others:
        if not (x2 + padding < ox1 or ox2 + padding < x1 or y2 + padding < oy1 or oy2 + padding < y1):
            return True
    return False


def _carve_room(grid: list[list[str]], room: tuple[int, int, int, int]) -> None:
    x1, y1, x2, y2 = room
    for y in range(y1, y2 + 1):
        for x in range(x1, x2 + 1):
            grid[y][x] = "."


def _carve_h_corridor(grid: list[list[str]], x1: int, x2: int, y: int) -> None:
    for x in range(min(x1, x2), max(x1, x2) + 1):
        grid[y][x] = "."


def _carve_v_corridor(grid: list[list[str]], y1: int, y2: int, x: int) -> None:
    for y in range(min(y1, y2), max(y1, y2) + 1):
        grid[y][x] = "."


def _connect_rooms(
    grid: list[list[str]],
    start: tuple[int, int],
    end: tuple[int, int],
    rng: random.Random,
) -> None:
    x1, y1 = start
    x2, y2 = end
    if rng.random() < 0.5:
        _carve_h_corridor(grid, x1, x2, y1)
        _carve_v_corridor(grid, y1, y2, x2)
    else:
        _carve_v_corridor(grid, y1, y2, x1)
        _carve_h_corridor(grid, x1, x2, y2)


def _direction_target(direction: str) -> tuple[int, int]:
    targets = {
        "北": (ROGUELIKE_WIDTH // 2, 1),
        "东北": (ROGUELIKE_WIDTH - 2, 1),
        "东": (ROGUELIKE_WIDTH - 2, ROGUELIKE_HEIGHT // 2),
        "东南": (ROGUELIKE_WIDTH - 2, ROGUELIKE_HEIGHT - 2),
        "南": (ROGUELIKE_WIDTH // 2, ROGUELIKE_HEIGHT - 2),
        "西南": (1, ROGUELIKE_HEIGHT - 2),
        "西": (1, ROGUELIKE_HEIGHT // 2),
        "西北": (1, 1),
    }
    return targets.get(direction, (ROGUELIKE_WIDTH // 2, 1))


def _pick_exit_room(
    rooms: list[tuple[int, int, int, int]],
    direction: str,
) -> tuple[int, int, int, int]:
    target_x, target_y = _direction_target(direction)
    return min(
        rooms,
        key=lambda room: abs(_room_center(room)[0] - target_x) + abs(_room_center(room)[1] - target_y),
    )


def _exit_position(room: tuple[int, int, int, int], direction: str) -> tuple[int, int]:
    x1, y1, x2, y2 = room
    center_x, center_y = _room_center(room)
    if direction == "北":
        return (center_x, y1)
    if direction == "东北":
        return (x2, y1)
    if direction == "东":
        return (x2, center_y)
    if direction == "东南":
        return (x2, y2)
    if direction == "南":
        return (center_x, y2)
    if direction == "西南":
        return (x1, y2)
    if direction == "西":
        return (x1, center_y)
    return (x1, y1)


def _seal_walls(grid: list[list[str]]) -> None:
    walkable = {".", "@", ">"}
    height = len(grid)
    width = len(grid[0]) if grid else 0
    updates: list[tuple[int, int]] = []
    for y in range(height):
        for x in range(width):
            if grid[y][x] != " ":
                continue
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    nx = x + dx
                    ny = y + dy
                    if 0 <= nx < width and 0 <= ny < height and grid[ny][nx] in walkable:
                        updates.append((x, y))
                        dx = 2
                        break
                else:
                    continue
                break
    for x, y in updates:
        grid[y][x] = "#"


def _generate_roguelike_map(location: str, exits: list[str]) -> str:
    rng = _seeded_rng(location)
    grid = [[" " for _ in range(ROGUELIKE_WIDTH)] for _ in range(ROGUELIKE_HEIGHT)]

    rooms: list[tuple[int, int, int, int]] = []
    target_room_count = min(7, max(4, 3 + len(exits)))
    attempts = 24

    for _ in range(attempts):
        if len(rooms) >= target_room_count:
            break
        room_width = rng.randint(4, 7)
        room_height = rng.randint(3, 5)
        x1 = rng.randint(2, ROGUELIKE_WIDTH - room_width - 3)
        y1 = rng.randint(2, ROGUELIKE_HEIGHT - room_height - 3)
        room = (x1, y1, x1 + room_width - 1, y1 + room_height - 1)
        if _rooms_overlap(room, rooms, padding=1):
            continue
        _carve_room(grid, room)
        if rooms:
            _connect_rooms(grid, _room_center(rooms[-1]), _room_center(room), rng)
        rooms.append(room)

    if not rooms:
        fallback_room = (10, 6, 19, 12)
        _carve_room(grid, fallback_room)
        rooms.append(fallback_room)

    player_x, player_y = _room_center(rooms[0])
    grid[player_y][player_x] = "@"

    exit_specs: list[tuple[str, str]] = []
    used_positions: set[tuple[int, int]] = {(player_x, player_y)}
    for index, destination in enumerate(exits):
        direction = _EXIT_DIRECTIONS[index % len(_EXIT_DIRECTIONS)]
        room = _pick_exit_room(rooms, direction)
        exit_x, exit_y = _exit_position(room, direction)
        if (exit_x, exit_y) in used_positions:
            center_x, center_y = _room_center(room)
            exit_x, exit_y = center_x, center_y
        grid[exit_y][exit_x] = ">"
        used_positions.add((exit_x, exit_y))
        exit_specs.append((direction, destination))

    _seal_walls(grid)

    lines = ["".join(row).rstrip() for row in grid]
    legend = ["", f"当前位置: {location}", "符号: @ 你  > 出口"]
    if exit_specs:
        legend.append("出口图例:")
        for direction, destination in exit_specs:
            legend.append(f"{direction}: ◆[{destination}]")
    else:
        legend.append("出口图例: 暂无已知出口")
    return "\n".join(lines + legend)


async def generate_ascii_map(
    session_id: str,
    location: str,
    connections: dict[str, list[str]],
    explored: list[str],
    connection_id: str | None = None,
) -> dict:
    """Generate (or return cached) roguelike ASCII map for the current location.
    每个地点一张地形图，缓存在 map_cache.json 中。
    再次进入同一地点直接返回缓存，不重新生成。
    """
    exits = connections.get(location, [])
    map_key = _location_map_key(location)

    cache = _load_map_cache(session_id)
    maps = cache.get("maps", {}) if isinstance(cache, dict) else {}

    # Cache hit — same location, same exits
    if map_key in maps:
        return {"cache_key": map_key, "ascii_map": maps[map_key]}

    try:
        ascii_map = _generate_roguelike_map(location, exits)
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
    """Simple roguelike fallback when map generation fails."""
    exits = connections.get(location, [])
    lines = [
        "  ##########",
        " ##........##",
        " #....@.....#",
        " #..........#",
        " ##....>...##",
        "  ##########",
        "",
        f"当前位置: {location}",
        "符号: @ 你  > 出口",
    ]
    if exits:
        lines.append("出口图例:")
        for index, destination in enumerate(exits):
            direction = _EXIT_DIRECTIONS[index % len(_EXIT_DIRECTIONS)]
            lines.append(f"{direction}: ◆[{destination}]")
    else:
        lines.append("出口图例: 暂无已知出口")
    return "\n".join(lines)
