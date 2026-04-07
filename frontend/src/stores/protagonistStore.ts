import { create } from "zustand";
import type { Protagonist, CreateProtagonistRequest, UpdateProtagonistRequest } from "../types";
import {
  getProtagonists,
  createProtagonist,
  updateProtagonist,
  deleteProtagonist,
} from "../services/api";

interface ProtagonistState {
  protagonists: Protagonist[];
  loading: boolean;

  fetchProtagonists: () => Promise<void>;
  addProtagonist: (data?: CreateProtagonistRequest) => Promise<Protagonist>;
  editProtagonist: (id: string, data: UpdateProtagonistRequest) => Promise<Protagonist>;
  removeProtagonist: (id: string) => Promise<void>;
}

export const useProtagonistStore = create<ProtagonistState>((set) => ({
  protagonists: [],
  loading: false,

  fetchProtagonists: async () => {
    set({ loading: true });
    try {
      const protagonists = await getProtagonists();
      set({ protagonists, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  addProtagonist: async (data?: CreateProtagonistRequest) => {
    const p = await createProtagonist(data || { name: "新主角" });
    set((s) => ({ protagonists: [p, ...s.protagonists] }));
    return p;
  },

  editProtagonist: async (id: string, data: UpdateProtagonistRequest) => {
    const updated = await updateProtagonist(id, data);
    set((s) => ({
      protagonists: s.protagonists.map((p) => (p.id === id ? updated : p)),
    }));
    return updated;
  },

  removeProtagonist: async (id: string) => {
    await deleteProtagonist(id);
    set((s) => ({ protagonists: s.protagonists.filter((p) => p.id !== id) }));
  },
}));
