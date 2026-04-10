import { create } from "zustand";
import type { UserProtagonist, CreateUserProtagonistRequest, UpdateUserProtagonistRequest } from "../types";
import {
  getUserProtagonists,
  createUserProtagonist,
  updateUserProtagonist,
  deleteUserProtagonist,
  copyUserProtagonist,
} from "../services/api";

interface UserProtagonistState {
  userProtagonists: UserProtagonist[];
  loading: boolean;

  fetchUserProtagonists: () => Promise<void>;
  addUserProtagonist: (data?: CreateUserProtagonistRequest) => Promise<UserProtagonist>;
  editUserProtagonist: (id: string, data: UpdateUserProtagonistRequest) => Promise<UserProtagonist>;
  removeUserProtagonist: (id: string) => Promise<void>;
  duplicateUserProtagonist: (id: string, name: string) => Promise<UserProtagonist>;
}

export const useUserProtagonistStore = create<UserProtagonistState>((set) => ({
  userProtagonists: [],
  loading: false,

  fetchUserProtagonists: async () => {
    set({ loading: true });
    try {
      const userProtagonists = await getUserProtagonists();
      set({ userProtagonists, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  addUserProtagonist: async (data?: CreateUserProtagonistRequest) => {
    const p = await createUserProtagonist(data || { name: "新主角" });
    set((s) => ({ userProtagonists: [p, ...s.userProtagonists] }));
    return p;
  },

  editUserProtagonist: async (id: string, data: UpdateUserProtagonistRequest) => {
    const updated = await updateUserProtagonist(id, data);
    set((s) => ({
      userProtagonists: s.userProtagonists.map((p) => (p.id === id ? updated : p)),
    }));
    return updated;
  },

  removeUserProtagonist: async (id: string) => {
    await deleteUserProtagonist(id);
    set((s) => ({ userProtagonists: s.userProtagonists.filter((p) => p.id !== id) }));
  },

  duplicateUserProtagonist: async (id: string, name: string) => {
    const p = await copyUserProtagonist(id, name);
    set((s) => ({ userProtagonists: [p, ...s.userProtagonists] }));
    return p;
  },
}));
