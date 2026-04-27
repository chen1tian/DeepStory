from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class Message(BaseModel):
    id: str
    parent_id: str | None = None
    role: str  # "user" | "assistant" | "system"
    content: str
    thinking: str = ""
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
    user_protagonist_id: str | None = None  # bound user protagonist


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
    time: Optional[str] = ""
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
    location: str | None = ""
    sub_location: str | None = ""
    time: str | None = ""
    weather: str | None = ""
    atmosphere: str | None = ""
    danger_level: str | None = ""
    objects: list[SceneObject] = Field(default_factory=list)
    exits: list[SceneExit] = Field(default_factory=list)
    npcs: list[SceneNPC] = Field(default_factory=list)


class QuestInfo(BaseModel):
    name: str
    type: str | None = "side"  # main, side
    source_npc: str | None = ""
    objective: str | None = ""
    progress: str | None = ""
    status: str | None = "active"  # active, completed, failed


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


# --- User Protagonist schemas (用户化身) ---


class UserProtagonist(BaseModel):
    id: str
    name: str = "未命名主角"
    setting: str = ""  # character background / personality / description
    avatar_emoji: str = "🧑"
    avatar_url: str | None = None  # image URL from upload or AI generation
    is_default: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class CreateUserProtagonistRequest(BaseModel):
    name: str = "未命名主角"
    setting: str = ""
    avatar_emoji: str = "🧑"
    avatar_url: str | None = None
    is_default: bool = False


class UpdateUserProtagonistRequest(BaseModel):
    name: str | None = None
    setting: str | None = None
    avatar_emoji: str | None = None
    avatar_url: str | None = None
    is_default: bool | None = None


# --- NPC Protagonist schemas (角色池，原 Protagonist 系统) ---


class Protagonist(BaseModel):
    id: str
    name: str = "未命名主角"
    setting: str = ""  # character background / personality / description
    avatar_emoji: str = "🧑"
    avatar_url: str | None = None  # image URL from upload or AI generation
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
    avatar_url: str | None = None  # image URL from upload or AI generation
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class CreateSessionCharacterRequest(BaseModel):
    pool_id: str | None = None  # if provided, copy from protagonist pool
    name: str = "未命名角色"
    setting: str = ""
    avatar_emoji: str = "🧑"
    avatar_url: str | None = None


class UpdateSessionCharacterRequest(BaseModel):
    name: str | None = None
    setting: str | None = None
    avatar_emoji: str | None = None
    avatar_url: str | None = None


class CreateProtagonistRequest(BaseModel):
    name: str = "未命名主角"
    setting: str = ""
    avatar_emoji: str = "🧑"
    avatar_url: str | None = None
    is_default: bool = False


class UpdateProtagonistRequest(BaseModel):
    name: str | None = None
    setting: str | None = None
    avatar_emoji: str | None = None
    avatar_url: str | None = None
    is_default: bool | None = None


# --- Connection schemas ---

from enum import Enum


class ConnectionType(str, Enum):
    LLM = "llm"
    IMAGE_GENERATION = "image_generation"


class ImageGenConfig(BaseModel):
    image_size: str = "1024x1024"
    n: int = 1


class Connection(BaseModel):
    id: str
    name: str = "未命名连接"
    connection_type: ConnectionType = ConnectionType.LLM
    api_key: str = ""
    api_base_url: str = ""
    model_name: str = "gpt-4o-mini"
    is_default: bool = False
    image_gen_config: ImageGenConfig | None = None
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())

class CreateConnectionRequest(BaseModel):
    name: str = "未命名连接"
    connection_type: ConnectionType = ConnectionType.LLM
    api_key: str = ""
    api_base_url: str = ""
    model_name: str = "gpt-4o-mini"
    is_default: bool = False
    image_gen_config: ImageGenConfig | None = None

class UpdateConnectionRequest(BaseModel):
    name: str | None = None
    connection_type: ConnectionType | None = None
    api_key: str | None = None
    api_base_url: str | None = None
    model_name: str | None = None
    is_default: bool | None = None
    image_gen_config: ImageGenConfig | None = None

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


# --- Chat Hook schemas ---

class HookAction(BaseModel):
    """What to do with the hook result on the frontend."""
    type: str = "show_panel"
    # type options:
    #   render_branch_options - render selectable/editable branch option cards
    #   show_panel            - collapsible markdown panel with optional title
    #   inject_to_input       - fill the chat textarea with the result string
    #   send_message          - auto-send result as a chat message
    #   show_toast            - show a brief notification toast
    #   custom_script         - run user-provided JS (context object passed in)
    panel_title: str = ""       # used by show_panel
    script: str = ""            # used by custom_script


class HookCallback(BaseModel):
    """Callback configuration for after a hook completes."""
    type: str = "none"              # "none" | "send_message" | "trigger_hook" | "custom"
    target_hook_id: str = ""        # hook ID to chain when type is "trigger_hook"
    payload_template: str = ""      # template for constructing follow-up payload
    condition: str = ""             # expression evaluated for "custom" type (empty = always)


class ChatHook(BaseModel):
    id: str
    name: str = "未命名 Hook"
    enabled: bool = True
    trigger: str = "chat_complete"   # "chat_complete" | "state_updated"
    context_messages: int = 6        # how many recent messages to include (0 = none)
    include_state: bool = False      # whether to inject RPG state summary
    prompt: str = ""                 # task instruction sent to LLM
    response_key: str = ""           # JSON key name for this hook's result in the batched LLM response
    response_schema: str = ""        # describes expected format e.g. "array of {label, prompt}"
    action: HookAction = Field(default_factory=HookAction)
    connection_id: str | None = None  # optional override; falls back to active connection
    # Agent-based execution fields (Phase 3)
    agent_mode: str = "batch"         # "batch" | "individual"
    agent_tools: list[str] = Field(default_factory=list)  # enabled tool names for this hook
    after_hook_callback: HookCallback | None = None
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class CreateHookRequest(BaseModel):
    name: str = "未命名 Hook"
    enabled: bool = True
    trigger: str = "chat_complete"
    context_messages: int = 6
    include_state: bool = False
    prompt: str = ""
    response_key: str = ""
    response_schema: str = ""
    action: HookAction = Field(default_factory=HookAction)
    connection_id: str | None = None
    agent_mode: str = "batch"
    agent_tools: list[str] = Field(default_factory=list)
    after_hook_callback: HookCallback | None = None


class UpdateHookRequest(BaseModel):
    name: str | None = None
    enabled: bool | None = None
    trigger: str | None = None
    context_messages: int | None = None
    include_state: bool | None = None
    prompt: str | None = None
    response_key: str | None = None
    response_schema: str | None = None
    action: HookAction | None = None
    connection_id: str | None = None
    agent_mode: str | None = None
    agent_tools: list[str] | None = None
    after_hook_callback: HookCallback | None = None


# --- Narrator (故事导演) schemas ---

class StoryNode(BaseModel):
    """A story milestone that the narrator monitors and aims to reach."""
    id: str
    title: str = "未命名节点"
    description: str = ""        # what this node represents / what should happen
    conditions: str = ""         # natural language trigger conditions, evaluated by LLM
    status: str = "pending"      # "pending" | "active" | "completed" | "skipped"
    order: int = 0
    directives_template: list[str] = Field(default_factory=list)  # directive prompts to use when node activates
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class NarrativeDirective(BaseModel):
    """A generated instruction injected into the system prompt to guide story direction."""
    id: str
    type: str = "custom"
    # type options:
    #   introduce_character  - bring a new character into the scene
    #   introduce_threat     - introduce conflict/antagonist/danger
    #   atmosphere           - set/enhance mood, descriptions, ambiance
    #   advance_quest        - push the main quest forward
    #   reveal_information   - reveal a clue, secret, or plot twist
    #   create_dilemma       - put the protagonist in a difficult choice
    #   foreshadow           - plant seeds for future events
    #   pacing               - control story pacing (slow down / speed up)
    #   custom               - free-form directive
    content: str = ""            # the actual text injected into the system prompt
    priority: int = 5            # 1-10, higher = injected first
    persistent: bool = False     # True = stays until manually removed; False = consumed after one turn
    turns_remaining: int | None = None  # limited-life directive; None = unlimited
    source_node_id: str | None = None
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    consumed_at: str | None = None


class NarratorEvaluation(BaseModel):
    """A record of one narrator evaluation cycle."""
    turn: int = 0
    summary: str = ""                      # brief narrative assessment
    node_changes: list[dict[str, Any]] = Field(default_factory=list)  # [{node_id, old_status, new_status}]
    new_directive_ids: list[str] = Field(default_factory=list)
    tension_adjustment: int = 0            # -3 to +3 change this cycle
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())


class NarratorArc(BaseModel):
    """Story arc configuration defining the long-term narrative trajectory."""
    id: str
    session_id: str
    title: str = "未命名弧线"
    goal: str = ""               # the overarching narrative goal
    themes: list[str] = Field(default_factory=list)  # e.g. ["友情", "背叛", "成长"]
    tone: str = ""               # overall tone e.g. "悬疑紧张" / "温情治愈"
    pacing_notes: str = ""       # pacing guidance e.g. "每5轮设置一个小高潮"
    tension_level: int = 3       # 0-10, current narrative tension
    nodes: list[StoryNode] = Field(default_factory=list)
    active_directives: list[NarrativeDirective] = Field(default_factory=list)
    evaluation_log: list[NarratorEvaluation] = Field(default_factory=list)  # last 10
    enabled: bool = True
    connection_id: str | None = None
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class CreateArcRequest(BaseModel):
    title: str = "未命名弧线"
    goal: str = ""
    themes: list[str] = Field(default_factory=list)
    tone: str = ""
    pacing_notes: str = ""
    tension_level: int = 3
    nodes: list[dict[str, Any]] = Field(default_factory=list)
    connection_id: str | None = None


class UpdateArcRequest(BaseModel):
    title: str | None = None
    goal: str | None = None
    themes: list[str] | None = None
    tone: str | None = None
    pacing_notes: str | None = None
    tension_level: int | None = None
    enabled: bool | None = None
    connection_id: str | None = None


class CreateNodeRequest(BaseModel):
    title: str = "未命名节点"
    description: str = ""
    conditions: str = ""
    order: int = 0
    directives_template: list[str] = Field(default_factory=list)


class UpdateNodeRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    conditions: str | None = None
    order: int | None = None
    status: str | None = None
    directives_template: list[str] | None = None


class CreateDirectiveRequest(BaseModel):
    type: str = "custom"
    content: str = ""
    priority: int = 5
    persistent: bool = False
    turns_remaining: int | None = None


class GenerateNodesRequest(BaseModel):
    goal: str                         # the story goal to generate nodes for
    count: int = 5                    # how many nodes to generate
    context: str = ""                 # optional existing story context
    connection_id: str | None = None


# --- API request/response schemas ---


class CreateSessionRequest(BaseModel):
    title: str = "新的对话"
    system_prompt: str = ""
    story_id: str | None = None
    opener_index: int = 0
    protagonist_id: str | None = None
    user_protagonist_id: str | None = None  # user protagonist (avatar)
    preset_id: str | None = None  # explicit preset to apply


class SessionResponse(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    preset_id: str | None = None
    characters: list[SessionCharacter] = Field(default_factory=list)
    user_protagonist_id: str | None = None


class MessagesResponse(BaseModel):
    messages: list[Message]
    active_branch: list[str]


# --- WebSocket message schemas ---


class WSMessageIn(BaseModel):
    type: str  # "chat" | "chat_from_branch" | "ping" | "submit_turn" | "retract_turn" | "force_submit"
    content: str = ""
    branch_from_message_id: str | None = None
    connection_id: str | None = None
    state_connection_id: str | None = None  # override connection for state extraction
    context_max_tokens: int | None = None  # override max_context_tokens from frontend config


class WSMessageOut(BaseModel):
    type: str  # "token" | "thinking" | "chat_complete" | "summary_progress" | "state_updated" | "hook_result" | "error" | "pong"
    content: str = ""
    message_id: str = ""
    status: str = ""
    data: dict[str, Any] | None = None


class EditorGenerateRequest(BaseModel):
    description: str
    template: str = "bubble"  # "bubble" | "card" | "rpg"
    connection_id: str | None = None


# --- Multiplayer Room schemas ---

class PlayerInfo(BaseModel):
    user_id: str
    username: str
    is_host: bool = False
    is_online: bool = True
    has_submitted: bool = False
    protagonist_name: str = ""
    protagonist_avatar: str = "🧑"
    protagonist_avatar_url: str | None = None
    protagonist_setting: str = ""


class RoomState(BaseModel):
    room_code: str
    session_id: str
    host_user_id: str
    players: list[PlayerInfo] = Field(default_factory=list)
    pending_turns: dict[str, str] = Field(default_factory=dict)  # user_id -> content
    round_status: str = "collecting"  # "collecting" | "processing"


class CreateRoomRequest(BaseModel):
    session_id: str


class JoinRoomRequest(BaseModel):
    room_code: str
    user_protagonist_id: str | None = None


class JoinRoomResponse(BaseModel):
    session_id: str
    room_state: RoomState


class TokenBudgetInfo(BaseModel):
    total: int
    system_prompt: int = 0
    state: int = 0
    summary: int = 0
    messages: int = 0
    reserved: int = 0
    remaining: int = 0
