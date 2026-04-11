import { create } from "zustand";
import type { ChatHook, CreateHookRequest, UpdateHookRequest, HookResultPayload } from "../types";
import { getHooks, createHook, updateHook, deleteHook } from "../services/api";

interface HookState {
  hooks: ChatHook[];
  loading: boolean;
  /** hookId → latest result payload, cleared at start of each new message */
  activeResults: Record<string, HookResultPayload>;

  fetchHooks: () => Promise<void>;
  addHook: (data?: CreateHookRequest) => Promise<ChatHook>;
  editHook: (id: string, data: UpdateHookRequest) => Promise<void>;
  removeHook: (id: string) => Promise<void>;
  /** Called by chatStore when a hook_result WS message arrives */
  setResult: (hookId: string, payload: HookResultPayload) => void;
  /** Clear all results — called when a new user message is sent */
  clearResults: () => void;
}

export const useHookStore = create<HookState>((set, get) => ({
  hooks: [],
  loading: false,
  activeResults: {},

  fetchHooks: async () => {
    set({ loading: true });
    try {
      const hooks = await getHooks();
      set({ hooks });
    } finally {
      set({ loading: false });
    }
  },

  addHook: async (data = {}) => {
    const hook = await createHook(data);
    set((s) => ({ hooks: [...s.hooks, hook] }));
    return hook;
  },

  editHook: async (id, data) => {
    const updated = await updateHook(id, data);
    set((s) => ({
      hooks: s.hooks.map((h) => (h.id === id ? updated : h)),
    }));
  },

  removeHook: async (id) => {
    await deleteHook(id);
    set((s) => ({ hooks: s.hooks.filter((h) => h.id !== id) }));
  },

  setResult: (hookId, payload) => {
    set((s) => ({
      activeResults: { ...s.activeResults, [hookId]: payload },
    }));
  },

  clearResults: () => set({ activeResults: {} }),
}));
