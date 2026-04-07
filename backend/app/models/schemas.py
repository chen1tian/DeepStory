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


# --- API request/response schemas ---


class CreateSessionRequest(BaseModel):
    title: str = "新的对话"
    system_prompt: str = ""


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
