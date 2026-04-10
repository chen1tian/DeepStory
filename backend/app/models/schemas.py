from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class Message(BaseModel):
    id: str
    parent_id: str | None = None
    role: str  # "user" | "assistant" | "system"
    content: str
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())
    token_count: int = 0
    branch_id: str = "main"


class SessionMeta(BaseModel):
    id: str
    title: str = "新的对话"
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    system_prompt: str = ""
    active_branch: list[str] = Field(default_factory=lambda: [])  # ordered message ids
    preset_id: str | None = None
    characters: list[SessionCharacter] = Field(default_factory=list)


class SummaryData(BaseModel):
    rolling_summary: str = ""
    last_summarized_index: int = 0
    token_count: int = 0


class CharacterInfo(BaseModel):
    name: str
    description: str = ""
    status: str = ""


class EventInfo(BaseModel):
    description: str
    timestamp: str = ""


class WorldState(BaseModel):
    location: str = ""
    time: str = ""
    atmosphere: str = ""
    key_items: list[str] = Field(default_factory=list)


# ── RPG State System ──

class StatusEffect(BaseModel):
    name: str
    source: str = ""
    impact: str = ""
    remaining_turns: int | None = None


class EquipmentItem(BaseModel):
    name: str
    slot: str = ""  # weapon, armor, accessory
    bonus: str = ""
    durability: int = 100


class Skill(BaseModel):
    name: str
    level: int = 1
    cooldown: int = 0
    available: bool = True
    restriction: str = ""  # e.g. "因伤受限"


class Relationship(BaseModel):
    npc: str
    attitude: str = ""  # 友好/中立/敌对
    note: str = ""


class RPGCharacter(BaseModel):
    name: str
    description: str = ""
    is_protagonist: bool = False
    # Attributes
    health: int = 100
    max_health: int = 100
    energy: int = 100
    max_energy: int = 100
    # Status
    status_effects: list[StatusEffect] = Field(default_factory=list)
    injuries: list[str] = Field(default_factory=list)
    mood: str = ""
    # Equipment & Skills
    equipment: list[EquipmentItem] = Field(default_factory=list)
    skills: list[Skill] = Field(default_factory=list)
    # Social
    relationships: list[Relationship] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)  # ["曾救过村长女儿", "被黑风寨通缉"]


class InventoryItem(BaseModel):
    name: str
    category: str = ""  # equipment, consumable, key_item, material
    description: str = ""
    quantity: int = 1
    effect: str = ""
    related_quest: str = ""


class SceneObject(BaseModel):
    name: str
    interactable: bool = True
    description: str = ""


class SceneExit(BaseModel):
    direction: str
    destination: str
    accessible: bool = True
    note: str = ""


class SceneNPC(BaseModel):
    name: str
    attitude: str = ""
    status: str = ""


class MapLocation(BaseModel):
    name: str
    discovered_at: str = ""
    notes: str = ""


class SceneState(BaseModel):
    location: str = ""
    sub_location: str = ""
    time: str = ""
    weather: str = ""
    atmosphere: str = ""
    danger_level: str = ""
    objects: list[SceneObject] = Field(default_factory=list)
    exits: list[SceneExit] = Field(default_factory=list)
    npcs: list[SceneNPC] = Field(default_factory=list)


class QuestInfo(BaseModel):
    name: str
    type: str = "side"  # main, side
    source_npc: str = ""
    objective: str = ""
    progress: str = ""
    status: str = "active"  # active, completed, failed


class StateChangeEvent(BaseModel):
    turn: int = 0
    description: str
    changes: list[str] = Field(default_factory=list)  # ["主角体力-20", "获得灵石×5"]
    timestamp: str = ""


class RPGStateData(BaseModel):
    """Full RPG state - stored in state.json, shown in frontend panel."""
    characters: list[RPGCharacter] = Field(default_factory=list)
    inventory: list[InventoryItem] = Field(default_factory=list)
    scene: SceneState = Field(default_factory=SceneState)
    explored_locations: list[MapLocation] = Field(default_factory=list)
    region_connections: dict[str, list[str]] = Field(default_factory=dict)  # {"青云镇": ["翠竹林", "矿山"]}
    quests: list[QuestInfo] = Field(default_factory=list)
    event_log: list[StateChangeEvent] = Field(default_factory=list)
    version: int = 0
    turn_count: int = 0


class RPGStateSummary(BaseModel):
    """Compact summary for prompt injection - always injected, <=500 tokens."""
    protagonist_summary: str = ""  # One-line: "主角林风，体力70%，右臂受伤，行动受限"
    scene_summary: str = ""        # "荒废古寺·后殿，深夜暴雨，阴森压抑"
    active_quest: str = ""         # "主线：寻找失落的灵石，正在调查古寺线索"
    key_inventory: str = ""        # "携带破军剑、疗伤丹×2、藏宝图残片"
    recent_events: str = ""        # "刚击退黑衣人偷袭，发现暗门机关"
    nearby_npcs: str = ""          # "神秘老者（友好），在殿中打坐"


class RPGStateDelta(BaseModel):
    """Changes extracted from a single AI response."""
    character_updates: list[dict[str, Any]] = Field(default_factory=list)
    inventory_changes: list[dict[str, Any]] = Field(default_factory=list)  # {action: "add"|"remove"|"use", item: ...}
    scene_changes: dict[str, Any] = Field(default_factory=dict)
    quest_updates: list[dict[str, Any]] = Field(default_factory=list)
    new_events: list[StateChangeEvent] = Field(default_factory=list)


class StateData(BaseModel):
    characters: list[CharacterInfo] = Field(default_factory=list)
    events: list[EventInfo] = Field(default_factory=list)
    world_state: WorldState = Field(default_factory=WorldState)
    version: int = 0
    # RPG extensions
    rpg: RPGStateData = Field(default_factory=RPGStateData)
    rpg_summary: RPGStateSummary = Field(default_factory=RPGStateSummary)


# --- Story schemas ---


class StoryOpener(BaseModel):
    """A single opening message for a story."""
    label: str = ""  # short description like "悬念开场"
    content: str = ""


class Story(BaseModel):
    id: str
    title: str = "未命名故事"
    description: str = ""  # brief summary shown in card
    background: str = ""  # detailed setting injected as system prompt
    openers: list[StoryOpener] = Field(default_factory=list)
    preset_characters: list[CharacterInfo] = Field(default_factory=list)
    color: str = "#6366f1"  # tag / card accent color
    protagonist_id: str | None = None  # bound protagonist
    cast_ids: list[str] = Field(default_factory=list)  # IDs of protagonists in the cast
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class CreateStoryRequest(BaseModel):
    title: str = "未命名故事"
    description: str = ""
    background: str = ""
    openers: list[StoryOpener] = Field(default_factory=list)
    preset_characters: list[CharacterInfo] = Field(default_factory=list)
    color: str = "#6366f1"
    cast_ids: list[str] = Field(default_factory=list)


class UpdateStoryRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    background: str | None = None
    openers: list[StoryOpener] | None = None
    preset_characters: list[CharacterInfo] | None = None
    color: str | None = None
    protagonist_id: str | None = None
    cast_ids: list[str] | None = None


# --- Protagonist schemas ---


class Protagonist(BaseModel):
    id: str
    name: str = "未命名主角"
    setting: str = ""  # character background / personality / description
    avatar_emoji: str = "🧑"
    is_default: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())


# --- Session Character schemas (per-session copies, isolated from protagonist pool) ---


class SessionCharacter(BaseModel):
    id: str
    pool_id: str | None = None  # reference to source Protagonist, None if created ad-hoc
    name: str = "未命名角色"
    setting: str = ""
    avatar_emoji: str = "🧑"
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class CreateSessionCharacterRequest(BaseModel):
    pool_id: str | None = None  # if provided, copy from protagonist pool
    name: str = "未命名角色"
    setting: str = ""
    avatar_emoji: str = "🧑"


class UpdateSessionCharacterRequest(BaseModel):
    name: str | None = None
    setting: str | None = None
    avatar_emoji: str | None = None


class CreateProtagonistRequest(BaseModel):
    name: str = "未命名主角"
    setting: str = ""
    avatar_emoji: str = "🧑"
    is_default: bool = False


class UpdateProtagonistRequest(BaseModel):
    name: str | None = None
    setting: str | None = None
    avatar_emoji: str | None = None
    is_default: bool | None = None


# --- Preset schemas ---


class Preset(BaseModel):
    id: str
    name: str = "未命名预设"
    description: str = ""
    content: str = ""  # system prompt text
    is_default: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class CreatePresetRequest(BaseModel):
    name: str = "未命名预设"
    description: str = ""
    content: str = ""
    is_default: bool = False


class UpdatePresetRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    content: str | None = None
    is_default: bool | None = None


class UpdateSystemPromptRequest(BaseModel):
    system_prompt: str | None = None
    preset_id: str | None = None


# --- API request/response schemas ---


class CreateSessionRequest(BaseModel):
    title: str = "新的对话"
    system_prompt: str = ""
    story_id: str | None = None
    opener_index: int = 0
    protagonist_id: str | None = None


class SessionResponse(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    preset_id: str | None = None
    characters: list[SessionCharacter] = Field(default_factory=list)


class MessagesResponse(BaseModel):
    messages: list[Message]
    active_branch: list[str]


# --- WebSocket message schemas ---


class WSMessageIn(BaseModel):
    type: str  # "chat" | "chat_from_branch" | "ping"
    content: str = ""
    branch_from_message_id: str | None = None


class WSMessageOut(BaseModel):
    type: str  # "token" | "chat_complete" | "summary_progress" | "state_updated" | "error" | "pong"
    content: str = ""
    message_id: str = ""
    status: str = ""
    data: dict[str, Any] | None = None


class EditorGenerateRequest(BaseModel):
    description: str
    template: str = "bubble"  # "bubble" | "card" | "rpg"


class TokenBudgetInfo(BaseModel):
    total: int
    system_prompt: int = 0
    state: int = 0
    summary: int = 0
    messages: int = 0
    reserved: int = 0
    remaining: int = 0
