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


class StateData(BaseModel):
    characters: list[CharacterInfo] = Field(default_factory=list)
    events: list[EventInfo] = Field(default_factory=list)
    world_state: WorldState = Field(default_factory=WorldState)
    version: int = 0


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
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class CreateStoryRequest(BaseModel):
    title: str = "未命名故事"
    description: str = ""
    background: str = ""
    openers: list[StoryOpener] = Field(default_factory=list)
    preset_characters: list[CharacterInfo] = Field(default_factory=list)
    color: str = "#6366f1"


class UpdateStoryRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    background: str | None = None
    openers: list[StoryOpener] | None = None
    preset_characters: list[CharacterInfo] | None = None
    color: str | None = None
    protagonist_id: str | None = None


# --- Protagonist schemas ---


class Protagonist(BaseModel):
    id: str
    name: str = "未命名主角"
    setting: str = ""  # character background / personality / description
    avatar_emoji: str = "🧑"
    is_default: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())


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
