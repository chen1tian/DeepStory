import type {
  Session,
  CreateSessionRequest,
  Message,
  StateData,
  EditorTemplate,
  Story,
  CreateStoryRequest,
  UpdateStoryRequest,
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
