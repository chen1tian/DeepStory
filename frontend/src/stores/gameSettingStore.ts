import { create } from "zustand";
import type { CreateGameSettingRequest, GameSetting, UpdateGameSettingRequest } from "../types";
import {
  createGameSetting,
  deleteGameSetting,
  getGameSettings,
  updateGameSetting,
} from "../services/api";

interface GameSettingState {
  settings: GameSetting[];
  loading: boolean;
  fetchSettings: () => Promise<void>;
  addSetting: (data?: CreateGameSettingRequest) => Promise<GameSetting>;
  editSetting: (id: string, data: UpdateGameSettingRequest) => Promise<GameSetting>;
  removeSetting: (id: string) => Promise<void>;
}

export const useGameSettingStore = create<GameSettingState>((set) => ({
  settings: [],
  loading: false,

  fetchSettings: async () => {
    set({ loading: true });
    try {
      const settings = await getGameSettings();
      set({ settings, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  addSetting: async (data?: CreateGameSettingRequest) => {
    const setting = await createGameSetting(data || { name: "新设定" });
    set((s) => ({ settings: [setting, ...s.settings] }));
    return setting;
  },

  editSetting: async (id: string, data: UpdateGameSettingRequest) => {
    const updated = await updateGameSetting(id, data);
    set((s) => ({
      settings: s.settings.map((item) => (item.id === id ? updated : item)),
    }));
    return updated;
  },

  removeSetting: async (id: string) => {
    await deleteGameSetting(id);
    set((s) => ({ settings: s.settings.filter((item) => item.id !== id) }));
  },
}));
