import { create } from "zustand";
import type { Session } from "../types";
import { getSessions, createSession, deleteSession } from "../services/api";

interface SessionState {
  sessions: Session[];        // all sessions from backend
  openSessionIds: string[];   // IDs of tabs currently open
  currentSessionId: string | null;
  loading: boolean;

  fetchSessions: () => Promise<void>;
  addSession: (title?: string, storyId?: string, openerIndex?: number, protagonistId?: string, systemPrompt?: string) => Promise<Session>;
  removeSession: (id: string) => Promise<void>;  // permanent delete
  closeTab: (id: string) => void;                 // close tab only
  openTab: (id: string) => void;                  // reopen from history
  selectSession: (id: string) => void;
}

const LAST_SESSION_KEY = "lastSessionId";
const OPEN_TABS_KEY = "openSessionIds";

function saveOpenTabs(ids: string[]) {
  localStorage.setItem(OPEN_TABS_KEY, JSON.stringify(ids));
}

function loadOpenTabs(): string[] {
  try {
    const raw = localStorage.getItem(OPEN_TABS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  openSessionIds: [],
  currentSessionId: null,
  loading: false,

  fetchSessions: async () => {
    set({ loading: true });
    try {
      const sessions = await getSessions();
      const savedTabs = loadOpenTabs();
      // Filter out tabs whose sessions no longer exist
      const validIds = new Set(sessions.map((s) => s.id));
      const openSessionIds = savedTabs.filter((id) => validIds.has(id));
      const saved = localStorage.getItem(LAST_SESSION_KEY);
      const restoredId = saved && validIds.has(saved) && openSessionIds.includes(saved) ? saved : null;
      saveOpenTabs(openSessionIds);
      set({ sessions, openSessionIds, loading: false, currentSessionId: restoredId });
    } catch {
      set({ loading: false });
    }
  },

  addSession: async (title?: string, storyId?: string, openerIndex?: number, protagonistId?: string, systemPrompt?: string) => {
    const session = await createSession({
      title: title || "新的对话",
      system_prompt: systemPrompt,
      story_id: storyId,
      opener_index: openerIndex,
      protagonist_id: protagonistId,
    });
    localStorage.setItem(LAST_SESSION_KEY, session.id);
    set((s) => {
      const openSessionIds = [session.id, ...s.openSessionIds];
      saveOpenTabs(openSessionIds);
      return {
        sessions: [session, ...s.sessions],
        openSessionIds,
        currentSessionId: session.id,
      };
    });
    return session;
  },

  removeSession: async (id: string) => {
    await deleteSession(id);
    set((s) => {
      const openSessionIds = s.openSessionIds.filter((sid) => sid !== id);
      saveOpenTabs(openSessionIds);
      const newCurrent = s.currentSessionId === id ? null : s.currentSessionId;
      if (newCurrent === null) localStorage.removeItem(LAST_SESSION_KEY);
      return {
        sessions: s.sessions.filter((sess) => sess.id !== id),
        openSessionIds,
        currentSessionId: newCurrent,
      };
    });
  },

  closeTab: (id: string) => {
    set((s) => {
      const openSessionIds = s.openSessionIds.filter((sid) => sid !== id);
      saveOpenTabs(openSessionIds);
      const newCurrent = s.currentSessionId === id ? null : s.currentSessionId;
      if (newCurrent === null) localStorage.removeItem(LAST_SESSION_KEY);
      return { openSessionIds, currentSessionId: newCurrent };
    });
  },

  openTab: (id: string) => {
    set((s) => {
      if (s.openSessionIds.includes(id)) return {};
      const openSessionIds = [...s.openSessionIds, id];
      saveOpenTabs(openSessionIds);
      return { openSessionIds };
    });
  },

  selectSession: (id: string) => {
    localStorage.setItem(LAST_SESSION_KEY, id);
    set({ currentSessionId: id });
  },
}));
