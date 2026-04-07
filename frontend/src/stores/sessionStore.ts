import { create } from "zustand";
import type { Session } from "../types";
import { getSessions, createSession, deleteSession } from "../services/api";

interface SessionState {
  sessions: Session[];
  currentSessionId: string | null;
  loading: boolean;

  fetchSessions: () => Promise<void>;
  addSession: (title?: string, storyId?: string, openerIndex?: number, protagonistId?: string, systemPrompt?: string) => Promise<Session>;
  removeSession: (id: string) => Promise<void>;
  selectSession: (id: string) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  loading: false,

  fetchSessions: async () => {
    set({ loading: true });
    try {
      const sessions = await getSessions();
      set({ sessions, loading: false });
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
    set((s) => ({
      sessions: [session, ...s.sessions],
      currentSessionId: session.id,
    }));
    return session;
  },

  removeSession: async (id: string) => {
    await deleteSession(id);
    set((s) => ({
      sessions: s.sessions.filter((sess) => sess.id !== id),
      currentSessionId: s.currentSessionId === id ? null : s.currentSessionId,
    }));
  },

  selectSession: (id: string) => {
    set({ currentSessionId: id });
  },
}));
