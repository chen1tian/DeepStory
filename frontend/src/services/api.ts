import type {
  Session,
  CreateSessionRequest,
  Message,
  StateData,
  EditorTemplate,
  Story,
  CreateStoryRequest,
  UpdateStoryRequest,
  Protagonist,
  CreateProtagonistRequest,
  UpdateProtagonistRequest,
  UserProtagonist,
  CreateUserProtagonistRequest,
  UpdateUserProtagonistRequest,
  Preset,
  CreatePresetRequest,
  UpdatePresetRequest,
  GameSetting,
  CreateGameSettingRequest,
  UpdateGameSettingRequest,
  SessionCharacter,
  CreateSessionCharacterRequest,
  UpdateSessionCharacterRequest,
  RPGCharacter,
  Connection,
  CreateConnectionRequest,
  UpdateConnectionRequest,
  TestConnectionResult,
  UploadImageResult,
  GenerateImageRequest,
  GenerateImageResult,
  FetchModelsResult,
  ChatHook,
  CreateHookRequest,
  UpdateHookRequest,
  NarratorArc,
  CreateArcRequest,
  UpdateArcRequest,
  CreateNodeRequest,
  UpdateNodeRequest,
  StoryNode,
  NarrativeDirective,
  CreateDirectiveRequest,
  GenerateNodesRequest,
  RoomState,
  JoinRoomResponse,
} from "../types";

const BASE = "/api";

function getToken(): string | null {
  // Read directly from localStorage to avoid circular import with store
  const token = localStorage.getItem("auth_token");
  return token;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...init,
  });
  if (res.status === 401) {
    // Token expired or invalid — force logout
    localStorage.removeItem("auth_token");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  // 204 No Content — nothing to parse
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }
  return res.json();
}

// Sessions
export const createSession = (data: CreateSessionRequest = {}) =>
  request<Session>("/sessions", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const getSessions = () => request<Session[]>("/sessions");

export const getSession = (id: string) => request<Session>(`/sessions/${id}`);

export const deleteSession = (id: string) =>
  request<{ status: string }>(`/sessions/${id}`, { method: "DELETE" });

export const branchFromMessage = (sessionId: string, messageId: string) =>
  request<{ active_branch: string[] }>(
    `/sessions/${sessionId}/branch?message_id=${encodeURIComponent(messageId)}`,
    { method: "POST" }
  );

// Chat messages
export const getMessages = (sessionId: string) =>
  request<{ messages: Message[]; active_branch: string[] }>(
    `/chat/${sessionId}/messages`
  );

export const deleteMessagesFrom = (sessionId: string, fromMessageId: string) =>
  request<{ ok: boolean }>(
    `/chat/${sessionId}/messages?from_message_id=${encodeURIComponent(fromMessageId)}`,
    { method: "DELETE" }
  );

// State
export const getState = (sessionId: string) =>
  request<StateData>(`/state/${sessionId}`);

// Editor
export const getCustomUI = (sessionId: string) =>
  request<{ html: string; is_default: boolean }>(`/editor/${sessionId}/ui`);

export const saveCustomUI = (sessionId: string, html: string) =>
  request<{ status: string }>(`/editor/${sessionId}/ui`, {
    method: "PUT",
    body: JSON.stringify({ html }),
  });

export const generateUI = (
  sessionId: string,
  description: string,
  template = "bubble"
) =>
  request<{ html: string }>(`/editor/${sessionId}/generate`, {
    method: "POST",
    body: JSON.stringify({ description, template, connection_id: localStorage.getItem("activeConnectionId") }),
  });

export const getTemplates = () =>
  request<{ templates: EditorTemplate[] }>("/editor/templates");

// Stories
export const getStories = () => request<Story[]>("/stories");

export const getStory = (id: string) => request<Story>(`/stories/${id}`);

export const createStory = (data: CreateStoryRequest = {}) =>
  request<Story>("/stories", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateStory = (id: string, data: UpdateStoryRequest) =>
  request<Story>(`/stories/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const deleteStory = (id: string) =>
  request<{ status: string }>(`/stories/${id}`, { method: "DELETE" });

// AI Assist
export const aiPolish = (original: string, instruction: string, fieldType: string) =>
  request<{ result: string }>("/ai/polish", {
    method: "POST",
    body: JSON.stringify({ original, instruction, field_type: fieldType, connection_id: localStorage.getItem("activeConnectionId") }),
  });

// Protagonists
export const getProtagonists = () => request<Protagonist[]>("/protagonists");

export const getProtagonist = (id: string) =>
  request<Protagonist>(`/protagonists/${id}`);

export const createProtagonist = (data: CreateProtagonistRequest = {}) =>
  request<Protagonist>("/protagonists", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateProtagonist = (id: string, data: UpdateProtagonistRequest) =>
  request<Protagonist>(`/protagonists/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const deleteProtagonist = (id: string) =>
  request<{ status: string }>(`/protagonists/${id}`, { method: "DELETE" });

export const copyProtagonist = (id: string, name: string) =>
  request<Protagonist>(`/protagonists/${id}/copy`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });

export const createProtagonistFromRPG = (char: RPGCharacter) =>
  request<Protagonist>(`/protagonists/from-rpg-character`, {
    method: "POST",
    body: JSON.stringify(char),
  });

// Session Characters
export const getSessionCharacters = (sessionId: string) =>
  request<SessionCharacter[]>(`/sessions/${sessionId}/characters`);

export const createSessionCharacter = (sessionId: string, data: CreateSessionCharacterRequest) =>
  request<SessionCharacter>(`/sessions/${sessionId}/characters`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateSessionCharacter = (sessionId: string, charId: string, data: UpdateSessionCharacterRequest) =>
  request<SessionCharacter>(`/sessions/${sessionId}/characters/${charId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const deleteSessionCharacter = (sessionId: string, charId: string) =>
  request<{ status: string }>(`/sessions/${sessionId}/characters/${charId}`, { method: "DELETE" });

export const copySessionCharacter = (sessionId: string, charId: string, name: string) =>
  request<SessionCharacter>(`/sessions/${sessionId}/characters/${charId}/copy`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });

export const pushCharacterToPool = (sessionId: string, charId: string) =>
  request<Protagonist>(`/sessions/${sessionId}/characters/${charId}/push-to-pool`, {
    method: "POST",
  });

export const pullCharacterFromPool = (sessionId: string, charId: string) =>
  request<SessionCharacter>(`/sessions/${sessionId}/characters/${charId}/pull-from-pool`, {
    method: "POST",
  });

// Set session protagonist
export const setSessionProtagonist = (sessionId: string, userProtagonistId: string | null) =>
  request<{ status: string; user_protagonist_id: string | null }>(
    `/sessions/${sessionId}/protagonist`,
    { method: "PUT", body: JSON.stringify({ user_protagonist_id: userProtagonistId }) }
  );

// User Protagonists
export const getUserProtagonists = () => request<UserProtagonist[]>("/user-protagonists");

export const createUserProtagonist = (data: CreateUserProtagonistRequest = {}) =>
  request<UserProtagonist>("/user-protagonists", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateUserProtagonist = (id: string, data: UpdateUserProtagonistRequest) =>
  request<UserProtagonist>(`/user-protagonists/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const deleteUserProtagonist = (id: string) =>
  request<{ status: string }>(`/user-protagonists/${id}`, { method: "DELETE" });

export const copyUserProtagonist = (id: string, name: string) =>
  request<UserProtagonist>(`/user-protagonists/${id}/copy`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });

// Presets
export const getPresets = () => request<Preset[]>("/presets");

export const getPreset = (id: string) => request<Preset>(`/presets/${id}`);

export const createPreset = (data: CreatePresetRequest = {}) =>
  request<Preset>("/presets", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updatePreset = (id: string, data: UpdatePresetRequest) =>
  request<Preset>(`/presets/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const deletePreset = (id: string) =>
  request<{ status: string }>(`/presets/${id}`, { method: "DELETE" });

// Game Settings / World Book
export const getGameSettings = () => request<GameSetting[]>("/settings");

export const createGameSetting = (data: CreateGameSettingRequest = {}) =>
  request<GameSetting>("/settings", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateGameSetting = (id: string, data: UpdateGameSettingRequest) =>
  request<GameSetting>(`/settings/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const deleteGameSetting = (id: string) =>
  request<{ status: string }>(`/settings/${id}`, { method: "DELETE" });

export const addSettingToSession = (sessionId: string, settingId: string) =>
  request<{ active_setting_ids: string[] }>(`/sessions/${sessionId}/settings/${settingId}`, {
    method: "POST",
  });

export const removeSettingFromSession = (sessionId: string, settingId: string) =>
  request<{ active_setting_ids: string[] }>(`/sessions/${sessionId}/settings/${settingId}`, {
    method: "DELETE",
  });

// Connections
export const getConnections = () => request<Connection[]>("/connections");

export const getConnection = (id: string) => request<Connection>(`/connections/${id}`);

export const createConnection = (data: CreateConnectionRequest = {}) =>
  request<Connection>("/connections", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateConnection = (id: string, data: UpdateConnectionRequest) =>
  request<Connection>(`/connections/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const deleteConnection = (id: string) =>
  request<{ status: string }>(`/connections/${id}`, { method: "DELETE" });

export const testConnection = (id: string) =>
  request<TestConnectionResult>(`/connections/${id}/test`, { method: "POST" });

export const fetchModels = (id: string) =>
  request<FetchModelsResult>(`/connections/${id}/models`, { method: "POST" });

// Session system prompt
export const updateSessionSystemPrompt = (
  sessionId: string,
  opts: { system_prompt?: string; preset_id?: string }
) =>
  request<{ status: string; system_prompt: string }>(
    `/sessions/${sessionId}/system-prompt`,
    {
      method: "PUT",
      body: JSON.stringify(opts),
    }
  );

// Debug
export interface DebugMessage {
  role: string;
  content: string;
  token_estimate: number;
}

export interface DebugPromptResponse {
  messages: DebugMessage[];
  budget: Record<string, number>;
  total_messages: number;
  system_prompt: string;
  summary: string;
  state_text: string;
}

export const getDebugPrompt = (sessionId: string, userInput = "（调试预览）") =>
  request<DebugPromptResponse>(`/debug/${sessionId}/prompt`, {
    method: "POST",
    body: JSON.stringify({ user_input: userInput }),
  });

// Hooks
export const getHooks = () => request<ChatHook[]>("/hooks");
export const getHook = (id: string) => request<ChatHook>(`/hooks/${id}`);
export const createHook = (data: CreateHookRequest = {}) =>
  request<ChatHook>("/hooks", { method: "POST", body: JSON.stringify(data) });
export const updateHook = (id: string, data: UpdateHookRequest) =>
  request<ChatHook>(`/hooks/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteHook = (id: string) =>
  request<{ status: string }>(`/hooks/${id}`, { method: "DELETE" });

// Map
export interface GenerateMapRequest {
  location: string;
  connections: Record<string, string[]>;
  explored_locations: string[];
  connection_id?: string | null;
}

export interface MapData {
  ascii_map: string | null;
  cache_key: string | null;
}

export const getMap = (sessionId: string) =>
  request<MapData>(`/sessions/${sessionId}/map`);

export const generateMap = (sessionId: string, data: GenerateMapRequest) =>
  request<MapData>(`/sessions/${sessionId}/map/generate`, {
    method: "POST",
    body: JSON.stringify(data),
  });

// Narrator (故事导演)
export const getArc = (sessionId: string) =>
  request<NarratorArc>(`/narrator/${sessionId}`);

export const createArc = (sessionId: string, data: CreateArcRequest = {}) =>
  request<NarratorArc>(`/narrator/${sessionId}`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateArc = (sessionId: string, data: UpdateArcRequest) =>
  request<NarratorArc>(`/narrator/${sessionId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const deleteArc = (sessionId: string) =>
  request<{ status: string }>(`/narrator/${sessionId}`, { method: "DELETE" });

export const toggleArc = (sessionId: string) =>
  request<NarratorArc>(`/narrator/${sessionId}/toggle`, { method: "POST" });

export const addNode = (sessionId: string, data: CreateNodeRequest) =>
  request<StoryNode>(`/narrator/${sessionId}/nodes`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateNode = (sessionId: string, nodeId: string, data: UpdateNodeRequest) =>
  request<StoryNode>(`/narrator/${sessionId}/nodes/${nodeId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const deleteNode = (sessionId: string, nodeId: string) =>
  request<{ status: string }>(`/narrator/${sessionId}/nodes/${nodeId}`, { method: "DELETE" });

export const generateNodes = (sessionId: string, data: GenerateNodesRequest) =>
  request<{ nodes: StoryNode[] }>(`/narrator/${sessionId}/generate-nodes`, {
    method: "POST",
    body: JSON.stringify({ ...data, connection_id: data.connection_id ?? localStorage.getItem("activeConnectionId") }),
  });

export const addDirective = (sessionId: string, data: CreateDirectiveRequest) =>
  request<NarrativeDirective>(`/narrator/${sessionId}/directives`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const deleteDirective = (sessionId: string, directiveId: string) =>
  request<{ status: string }>(`/narrator/${sessionId}/directives/${directiveId}`, {
    method: "DELETE",
  });

// Multiplayer Rooms
export const createRoom = (sessionId: string) =>
  request<RoomState>("/rooms", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId }),
  });

export const joinRoom = (roomCode: string, userProtagonistId?: string) =>
  request<JoinRoomResponse>("/rooms/join", {
    method: "POST",
    body: JSON.stringify({ room_code: roomCode, user_protagonist_id: userProtagonistId ?? null }),
  });

export const getRoom = (sessionId: string) =>
  request<RoomState>(`/rooms/${sessionId}`);

export const leaveRoom = (sessionId: string) =>
  request<void>(`/rooms/${sessionId}/leave`, { method: "DELETE" });

export const closeRoom = (sessionId: string) =>
  request<void>(`/rooms/${sessionId}`, { method: "DELETE" });

// Image Upload & Generation
export const uploadImage = async (file: File): Promise<UploadImageResult> => {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  // Note: do NOT set Content-Type for FormData — browser sets it automatically with boundary
  const res = await fetch(`${BASE}/images/upload`, {
    method: "POST",
    headers,
    body: formData,
  });
  if (res.status === 401) {
    localStorage.removeItem("auth_token");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json();
};

export const generateImage = (data: GenerateImageRequest) =>
  request<GenerateImageResult>("/image-gen/generate", {
    method: "POST",
    body: JSON.stringify(data),
  });
