import { create } from "zustand";

const CONFIG_KEY = "config_max_message_count";
const CONFIG_CONTEXT_KEY = "config_context_length";

function loadMaxMessageCount(): number {
  try {
    const v = localStorage.getItem(CONFIG_KEY);
    if (v !== null) {
      const n = parseInt(v, 10);
      if (!isNaN(n) && n >= 0) return n;
    }
  } catch { /* ignore */ }
  return 20;
}

function saveMaxMessageCount(n: number) {
  try {
    localStorage.setItem(CONFIG_KEY, String(n));
  } catch { /* ignore */ }
}

function loadContextLength(): number {
  try {
    const v = localStorage.getItem(CONFIG_CONTEXT_KEY);
    if (v !== null) {
      const n = parseInt(v, 10);
      if (!isNaN(n) && n >= 2048) return n;
    }
  } catch { /* ignore */ }
  return 81920;
}

function saveContextLength(n: number) {
  try {
    localStorage.setItem(CONFIG_CONTEXT_KEY, String(n));
  } catch { /* ignore */ }
}

interface UIState {
  editMode: boolean;
  sidebarOpen: boolean;
  statePanelOpen: boolean;
  showCharacterPanel: boolean;
  configOpen: boolean;
  maxMessageCount: number;
  contextLength: number;
  toasts: Array<{ id: string; message: string; type: "error" | "info" | "success" }>;

  toggleEditMode: () => void;
  toggleSidebar: () => void;
  toggleStatePanel: () => void;
  setShowCharacterPanel: (v: boolean) => void;
  setConfigOpen: (v: boolean) => void;
  setMaxMessageCount: (n: number) => void;
  setContextLength: (n: number) => void;
  addToast: (message: string, type?: "error" | "info" | "success") => void;
  removeToast: (id: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  editMode: false,
  sidebarOpen: true,
  statePanelOpen: false,
  showCharacterPanel: false,
  configOpen: false,
  maxMessageCount: loadMaxMessageCount(),
  contextLength: loadContextLength(),
  toasts: [],

  toggleEditMode: () => set((s) => ({ editMode: !s.editMode, showCharacterPanel: false })),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleStatePanel: () => set((s) => ({ statePanelOpen: !s.statePanelOpen })),
  setShowCharacterPanel: (v) => set({ showCharacterPanel: v, editMode: false }),

  setConfigOpen: (v) => set({ configOpen: v }),
  setMaxMessageCount: (n) => {
    saveMaxMessageCount(n);
    set({ maxMessageCount: n });
  },

  setContextLength: (n) => {
    saveContextLength(n);
    set({ contextLength: n });
  },

  addToast: (message, type = "info") => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  },

  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
