// --- Data models ---

export interface Message {
  id: string;
  parent_id: string | null;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  token_count: number;
  branch_id: string;
}

export interface Session {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface SummaryData {
  rolling_summary: string;
  last_summarized_index: number;
  token_count: number;
}

export interface CharacterInfo {
  name: string;
  description: string;
  status: string;
}

export interface EventInfo {
  description: string;
  timestamp: string;
}

export interface WorldState {
  location: string;
  time: string;
  atmosphere: string;
  key_items: string[];
}

export interface StateData {
  characters: CharacterInfo[];
  events: EventInfo[];
  world_state: WorldState;
  version: number;
}

export interface TokenBudgetInfo {
  total: number;
  system_prompt: number;
  state: number;
  summary: number;
  messages: number;
  reserved: number;
  remaining: number;
}

// --- WebSocket messages ---

export interface WSMessageIn {
  type: "chat" | "chat_from_branch" | "ping";
  content?: string;
  branch_from_message_id?: string;
}

export interface WSMessageOut {
  type:
    | "token"
    | "chat_complete"
    | "summary_progress"
    | "state_updated"
    | "error"
    | "pong"
    | "token_budget";
  content?: string;
  message_id?: string;
  status?: string;
  data?: Record<string, unknown>;
}

// --- API request/response ---

export interface CreateSessionRequest {
  title?: string;
  system_prompt?: string;
  story_id?: string;
  opener_index?: number;
  protagonist_id?: string;
}

export interface EditorTemplate {
  id: string;
  name: string;
  description: string;
}

// --- Story ---

export interface StoryOpener {
  label: string;
  content: string;
}

export interface Story {
  id: string;
  title: string;
  description: string;
  background: string;
  openers: StoryOpener[];
  preset_characters: CharacterInfo[];
  color: string;
  protagonist_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateStoryRequest {
  title?: string;
  description?: string;
  background?: string;
  openers?: StoryOpener[];
  preset_characters?: CharacterInfo[];
  color?: string;
}

export interface UpdateStoryRequest {
  title?: string;
  description?: string;
  background?: string;
  openers?: StoryOpener[];
  preset_characters?: CharacterInfo[];
  color?: string;
  protagonist_id?: string;
}

// --- Protagonist ---

export interface Protagonist {
  id: string;
  name: string;
  setting: string;
  avatar_emoji: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProtagonistRequest {
  name?: string;
  setting?: string;
  avatar_emoji?: string;
  is_default?: boolean;
}

export interface UpdateProtagonistRequest {
  name?: string;
  setting?: string;
  avatar_emoji?: string;
  is_default?: boolean;
}

// --- Preset ---

export interface Preset {
  id: string;
  name: string;
  description: string;
  content: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePresetRequest {
  name?: string;
  description?: string;
  content?: string;
  is_default?: boolean;
}

export interface UpdatePresetRequest {
  name?: string;
  description?: string;
  content?: string;
  is_default?: boolean;
}
