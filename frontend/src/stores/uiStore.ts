import { create } from "zustand";

interface UIState {
  editMode: boolean;
  sidebarOpen: boolean;
  statePanelOpen: boolean;
  toasts: Array<{ id: string; message: string; type: "error" | "info" | "success" }>;

  toggleEditMode: () => void;
  toggleSidebar: () => void;
  toggleStatePanel: () => void;
  addToast: (message: string, type?: "error" | "info" | "success") => void;
  removeToast: (id: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  editMode: false,
  sidebarOpen: true,
  statePanelOpen: false,
  toasts: [],

  toggleEditMode: () => set((s) => ({ editMode: !s.editMode })),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleStatePanel: () => set((s) => ({ statePanelOpen: !s.statePanelOpen })),

  addToast: (message, type = "info") => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  },

  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
