import { create } from "zustand";
import type { Story, CreateStoryRequest, UpdateStoryRequest } from "../types";
import {
  getStories,
  createStory,
  updateStory,
  deleteStory,
} from "../services/api";

interface StoryState {
  stories: Story[];
  loading: boolean;

  fetchStories: () => Promise<void>;
  addStory: (data?: CreateStoryRequest) => Promise<Story>;
  editStory: (id: string, data: UpdateStoryRequest) => Promise<Story>;
  removeStory: (id: string) => Promise<void>;
}

export const useStoryStore = create<StoryState>((set) => ({
  stories: [],
  loading: false,

  fetchStories: async () => {
    set({ loading: true });
    try {
      const stories = await getStories();
      set({ stories, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  addStory: async (data?: CreateStoryRequest) => {
    const story = await createStory(data || { title: "新故事" });
    set((s) => ({ stories: [story, ...s.stories] }));
    return story;
  },

  editStory: async (id: string, data: UpdateStoryRequest) => {
    const updated = await updateStory(id, data);
    set((s) => ({
      stories: s.stories.map((st) => (st.id === id ? updated : st)),
    }));
    return updated;
  },

  removeStory: async (id: string) => {
    await deleteStory(id);
    set((s) => ({ stories: s.stories.filter((st) => st.id !== id) }));
  },
}));
