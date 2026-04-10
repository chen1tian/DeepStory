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
  SessionCharacter,
  CreateSessionCharacterRequest,
  UpdateSessionCharacterRequest,
  RPGCharacter,
} from "../types";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
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
    body: JSON.stringify({ description, template }),
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
    body: JSON.stringify({ original, instruction, field_type: fieldType }),
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
