import { create } from "zustand";
import type { Session, SessionCharacter, CreateSessionCharacterRequest, UpdateSessionCharacterRequest } from "../types";
import { getSessions, createSession, deleteSession,
  getSessionCharacters, createSessionCharacter, updateSessionCharacter,
  deleteSessionCharacter, copySessionCharacter,
  pushCharacterToPool, pullCharacterFromPool,
  setSessionProtagonist,
} from "../services/api";

interface SessionState {
  sessions: Session[];        // all sessions from backend
  openSessionIds: string[];   // IDs of tabs currently open
  currentSessionId: string | null;
  loading: boolean;

  fetchSessions: () => Promise<void>;
  addSession: (title?: string, storyId?: string, openerIndex?: number, protagonistId?: string, systemPrompt?: string, presetId?: string) => Promise<Session>;
  removeSession: (id: string) => Promise<void>;  // permanent delete
  closeTab: (id: string) => void;                 // close tab only
  openTab: (id: string) => void;                  // reopen from history
  selectSession: (id: string) => void;
  updateSessionPreset: (id: string, presetId: string) => void;

  // Session character management
  fetchSessionCharacters: (sessionId: string) => Promise<SessionCharacter[]>;
  addCharacterToSession: (sessionId: string, data: CreateSessionCharacterRequest) => Promise<SessionCharacter>;
  updateCharacterInSession: (sessionId: string, charId: string, data: UpdateSessionCharacterRequest) => Promise<SessionCharacter>;
  removeCharacterFromSession: (sessionId: string, charId: string) => Promise<void>;
  copyCharacterInSession: (sessionId: string, charId: string, name: string) => Promise<SessionCharacter>;
  pushCharacterToPool: (sessionId: string, charId: string) => Promise<void>;
  pullCharacterFromPool: (sessionId: string, charId: string) => Promise<void>;

  // User protagonist management
  setSessionProtagonist: (sessionId: string, userProtagonistId: string | null) => Promise<void>;
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

  addSession: async (title?: string, storyId?: string, openerIndex?: number, protagonistId?: string, systemPrompt?: string, presetId?: string) => {
    const session = await createSession({
      title: title || "新的对话",
      system_prompt: systemPrompt,
      story_id: storyId,
      opener_index: openerIndex,
      protagonist_id: protagonistId,
      preset_id: presetId,
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

  updateSessionPreset: (id: string, presetId: string) => {
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === id ? { ...sess, preset_id: presetId } : sess
      ),
    }));
  },

  fetchSessionCharacters: async (sessionId: string) => {
    const chars = await getSessionCharacters(sessionId);
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId ? { ...sess, characters: chars } : sess
      ),
    }));
    return chars;
  },

  addCharacterToSession: async (sessionId: string, data: CreateSessionCharacterRequest) => {
    const char = await createSessionCharacter(sessionId, data);
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId ? { ...sess, characters: [...(sess.characters || []), char] } : sess
      ),
    }));
    return char;
  },

  updateCharacterInSession: async (sessionId: string, charId: string, data: UpdateSessionCharacterRequest) => {
    const updated = await updateSessionCharacter(sessionId, charId, data);
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId
          ? { ...sess, characters: (sess.characters || []).map((c) => c.id === charId ? updated : c) }
          : sess
      ),
    }));
    return updated;
  },

  removeCharacterFromSession: async (sessionId: string, charId: string) => {
    await deleteSessionCharacter(sessionId, charId);
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId
          ? { ...sess, characters: (sess.characters || []).filter((c) => c.id !== charId) }
          : sess
      ),
    }));
  },

  copyCharacterInSession: async (sessionId: string, charId: string, name: string) => {
    const char = await copySessionCharacter(sessionId, charId, name);
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId ? { ...sess, characters: [...(sess.characters || []), char] } : sess
      ),
    }));
    return char;
  },

  pushCharacterToPool: async (sessionId: string, charId: string) => {
    const protagonist = await pushCharacterToPool(sessionId, charId);
    // Back-link pool_id into local state
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId
          ? {
              ...sess,
              characters: (sess.characters || []).map((c) =>
                c.id === charId ? { ...c, pool_id: protagonist.id } : c
              ),
            }
          : sess
      ),
    }));
  },

  pullCharacterFromPool: async (sessionId: string, charId: string) => {
    const updated = await pullCharacterFromPool(sessionId, charId);
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId
          ? { ...sess, characters: (sess.characters || []).map((c) => c.id === charId ? updated : c) }
          : sess
      ),
    }));
  },

  setSessionProtagonist: async (sessionId: string, userProtagonistId: string | null) => {
    await setSessionProtagonist(sessionId, userProtagonistId);
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId ? { ...sess, user_protagonist_id: userProtagonistId } : sess
      ),
    }));
  },
}));
