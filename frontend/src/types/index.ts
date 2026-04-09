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

// ── RPG State Types ──

export interface StatusEffect {
  name: string;
  source: string;
  impact: string;
  remaining_turns: number | null;
}

export interface EquipmentItem {
  name: string;
  slot: string;
  bonus: string;
  durability: number;
}

export interface Skill {
  name: string;
  level: number;
  cooldown: number;
  available: boolean;
  restriction: string;
}

export interface Relationship {
  npc: string;
  attitude: string;
  note: string;
}

export interface RPGCharacter {
  name: string;
  description: string;
  is_protagonist: boolean;
  health: number;
  max_health: number;
  energy: number;
  max_energy: number;
  status_effects: StatusEffect[];
  injuries: string[];
  mood: string;
  equipment: EquipmentItem[];
  skills: Skill[];
  relationships: Relationship[];
  tags: string[];
}

export interface InventoryItem {
  name: string;
  category: string;
  description: string;
  quantity: number;
  effect: string;
  related_quest: string;
}

export interface SceneObject {
  name: string;
  interactable: boolean;
  description: string;
}

export interface SceneExit {
  direction: string;
  destination: string;
  accessible: boolean;
  note: string;
}

export interface SceneNPC {
  name: string;
  attitude: string;
  status: string;
}

export interface MapLocation {
  name: string;
  discovered_at: string;
  notes: string;
}

export interface SceneState {
  location: string;
  sub_location: string;
  time: string;
  weather: string;
  atmosphere: string;
  danger_level: string;
  objects: SceneObject[];
  exits: SceneExit[];
  npcs: SceneNPC[];
}

export interface QuestInfo {
  name: string;
  type: string;
  source_npc: string;
  objective: string;
  progress: string;
  status: string;
}

export interface StateChangeEvent {
  turn: number;
  description: string;
  changes: string[];
  timestamp: string;
}

export interface RPGStateData {
  characters: RPGCharacter[];
  inventory: InventoryItem[];
  scene: SceneState;
  explored_locations: MapLocation[];
  region_connections: Record<string, string[]>;
  quests: QuestInfo[];
  event_log: StateChangeEvent[];
  version: number;
  turn_count: number;
}

export interface RPGStateSummary {
  protagonist_summary: string;
  scene_summary: string;
  active_quest: string;
  key_inventory: string;
  recent_events: string;
  nearby_npcs: string;
}

export interface StateData {
  characters: CharacterInfo[];
  events: EventInfo[];
  world_state: WorldState;
  version: number;
  rpg: RPGStateData;
  rpg_summary: RPGStateSummary;
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
