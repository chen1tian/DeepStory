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

export interface SessionCharacter {
  id: string;
  pool_id: string | null;
  name: string;
  setting: string;
  avatar_emoji: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSessionCharacterRequest {
  pool_id?: string | null;
  name?: string;
  setting?: string;
  avatar_emoji?: string;
}

export interface UpdateSessionCharacterRequest {
  name?: string;
  setting?: string;
  avatar_emoji?: string;
}

export interface Session {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  preset_id?: string | null;
  characters: SessionCharacter[];
  user_protagonist_id?: string | null;
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
  connection_id?: string | null;
  state_connection_id?: string | null;
}

export interface WSMessageOut {
  type:
    | "token"
    | "chat_complete"
    | "summary_progress"
    | "state_updated"
    | "hook_result"
    | "narrator_update"
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
  user_protagonist_id?: string;
  connection_id?: string;
}

// --- Connections ---

export interface Connection {
  id: string;
  name: string;
  api_key: string;
  api_base_url: string;
  model_name: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateConnectionRequest {
  name?: string;
  api_key?: string;
  api_base_url?: string;
  model_name?: string;
  is_default?: boolean;
}

export interface UpdateConnectionRequest {
  name?: string;
  api_key?: string;
  api_base_url?: string;
  model_name?: string;
  is_default?: boolean;
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
  cast_ids: string[];
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
  cast_ids?: string[];
}

export interface UpdateStoryRequest {
  title?: string;
  description?: string;
  background?: string;
  openers?: StoryOpener[];
  preset_characters?: CharacterInfo[];
  color?: string;
  protagonist_id?: string;
  cast_ids?: string[];
}

// --- User Protagonist (用户化身) ---

export interface UserProtagonist {
  id: string;
  name: string;
  setting: string;
  avatar_emoji: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateUserProtagonistRequest {
  name?: string;
  setting?: string;
  avatar_emoji?: string;
  is_default?: boolean;
}

export interface UpdateUserProtagonistRequest {
  name?: string;
  setting?: string;
  avatar_emoji?: string;
  is_default?: boolean;
}

// --- Protagonist (角色池，NPC) ---

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

// --- Chat Hook system ---

export type HookActionType =
  | "render_branch_options"
  | "show_panel"
  | "inject_to_input"
  | "send_message"
  | "show_toast"
  | "custom_script";

export interface HookAction {
  type: HookActionType;
  panel_title: string;
  script: string;
}

export interface ChatHook {
  id: string;
  name: string;
  enabled: boolean;
  trigger: "chat_complete" | "state_updated";
  context_messages: number;
  include_state: boolean;
  prompt: string;
  response_key: string;
  response_schema: string;
  action: HookAction;
  connection_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateHookRequest {
  name?: string;
  enabled?: boolean;
  trigger?: "chat_complete" | "state_updated";
  context_messages?: number;
  include_state?: boolean;
  prompt?: string;
  response_key?: string;
  response_schema?: string;
  action?: Partial<HookAction>;
  connection_id?: string | null;
}

export interface UpdateHookRequest {
  name?: string;
  enabled?: boolean;
  trigger?: "chat_complete" | "state_updated";
  context_messages?: number;
  include_state?: boolean;
  prompt?: string;
  response_key?: string;
  response_schema?: string;
  action?: Partial<HookAction>;
  connection_id?: string | null;
}

/** Payload inside WSMessageOut.data when type === "hook_result" */
export interface HookResultPayload {
  hook_id: string;
  hook_name: string;
  action: HookAction;
  result: unknown;
}

// ── Narrator (故事导演) types ──

export type NarratorDirectiveType =
  | "introduce_character"
  | "introduce_threat"
  | "atmosphere"
  | "advance_quest"
  | "reveal_information"
  | "create_dilemma"
  | "foreshadow"
  | "pacing"
  | "custom";

export type StoryNodeStatus = "pending" | "active" | "completed" | "skipped";

export interface StoryNode {
  id: string;
  title: string;
  description: string;
  conditions: string;
  status: StoryNodeStatus;
  order: number;
  directives_template: string[];
  created_at: string;
}

export interface NarrativeDirective {
  id: string;
  type: NarratorDirectiveType;
  content: string;
  priority: number;
  persistent: boolean;
  turns_remaining: number | null;
  source_node_id: string | null;
  created_at: string;
  consumed_at: string | null;
}

export interface NarratorEvaluation {
  turn: number;
  summary: string;
  node_changes: Array<{
    node_id: string;
    title: string;
    old_status: StoryNodeStatus;
    new_status: StoryNodeStatus;
    reason: string;
  }>;
  new_directive_ids: string[];
  tension_adjustment: number;
  timestamp: string;
}

export interface NarratorArc {
  id: string;
  session_id: string;
  title: string;
  goal: string;
  themes: string[];
  tone: string;
  pacing_notes: string;
  tension_level: number;
  nodes: StoryNode[];
  active_directives: NarrativeDirective[];
  evaluation_log: NarratorEvaluation[];
  enabled: boolean;
  connection_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateArcRequest {
  title?: string;
  goal?: string;
  themes?: string[];
  tone?: string;
  pacing_notes?: string;
  tension_level?: number;
  nodes?: Partial<StoryNode>[];
  connection_id?: string | null;
}

export interface UpdateArcRequest {
  title?: string;
  goal?: string;
  themes?: string[];
  tone?: string;
  pacing_notes?: string;
  tension_level?: number;
  enabled?: boolean;
  connection_id?: string | null;
}

export interface CreateNodeRequest {
  title?: string;
  description?: string;
  conditions?: string;
  order?: number;
  directives_template?: string[];
}

export interface UpdateNodeRequest {
  title?: string;
  description?: string;
  conditions?: string;
  order?: number;
  status?: StoryNodeStatus;
  directives_template?: string[];
}

export interface CreateDirectiveRequest {
  type?: NarratorDirectiveType;
  content: string;
  priority?: number;
  persistent?: boolean;
  turns_remaining?: number | null;
}

export interface GenerateNodesRequest {
  goal: string;
  count?: number;
  context?: string;
  connection_id?: string | null;
}

export interface NarratorUpdatePayload {
  arc_id: string;
  assessment: string;
  tension_level: number;
  tension_adjustment: number;
  node_changes: NarratorEvaluation["node_changes"];
  new_directive_ids: string[];
  active_directives_count: number;
}
