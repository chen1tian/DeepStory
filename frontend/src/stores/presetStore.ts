import { create } from "zustand";
import type { Preset, CreatePresetRequest, UpdatePresetRequest } from "../types";
import {
  getPresets,
  createPreset,
  updatePreset,
  deletePreset,
} from "../services/api";

interface PresetState {
  presets: Preset[];
  loading: boolean;

  fetchPresets: () => Promise<void>;
  addPreset: (data?: CreatePresetRequest) => Promise<Preset>;
  editPreset: (id: string, data: UpdatePresetRequest) => Promise<Preset>;
  removePreset: (id: string) => Promise<void>;
}

export const usePresetStore = create<PresetState>((set) => ({
  presets: [],
  loading: false,

  fetchPresets: async () => {
    set({ loading: true });
    try {
      const presets = await getPresets();
      set({ presets, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  addPreset: async (data?: CreatePresetRequest) => {
    const p = await createPreset(data || { name: "新预设" });
    set((s) => ({ presets: [p, ...s.presets] }));
    return p;
  },

  editPreset: async (id: string, data: UpdatePresetRequest) => {
    const updated = await updatePreset(id, data);
    set((s) => ({
      presets: s.presets.map((p) => (p.id === id ? updated : p)),
    }));
    return updated;
  },

  removePreset: async (id: string) => {
    await deletePreset(id);
    set((s) => ({ presets: s.presets.filter((p) => p.id !== id) }));
  },
}));
