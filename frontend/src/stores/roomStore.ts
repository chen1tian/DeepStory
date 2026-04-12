import { create } from "zustand";
import type { RoomState, WSMessageOut } from "../types";
import { createRoom, joinRoom, leaveRoom, closeRoom } from "../services/api";
import { useAuthStore } from "./authStore";

interface RoomStoreState {
  roomState: RoomState | null;
  sessionId: string | null;
  stagedContent: string;
  isProcessing: boolean;

  // Actions
  openRoom: (sessionId: string) => Promise<RoomState>;
  joinRoom: (roomCode: string) => Promise<string>; // returns session_id
  exitRoom: () => Promise<void>;
  setStagedContent: (content: string) => void;
  handleRoomMessage: (msg: WSMessageOut) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomStoreState>((set, get) => ({
  roomState: null,
  sessionId: null,
  stagedContent: "",
  isProcessing: false,

  openRoom: async (sessionId: string) => {
    const room = await createRoom(sessionId);
    set({ roomState: room, sessionId });
    return room;
  },

  joinRoom: async (roomCode: string) => {
    const { session_id, room_state } = await joinRoom(roomCode);
    set({ roomState: room_state, sessionId: session_id });
    return session_id;
  },

  exitRoom: async () => {
    const { sessionId, roomState } = get();
    if (!sessionId || !roomState) return;
    const myId = useAuthStore.getState().user?.id;
    if (myId === roomState.host_user_id) {
      await closeRoom(sessionId).catch(() => {});
    } else {
      await leaveRoom(sessionId).catch(() => {});
    }
    set({ roomState: null, sessionId: null, stagedContent: "", isProcessing: false });
  },

  setStagedContent: (content: string) => set({ stagedContent: content }),

  handleRoomMessage: (msg: WSMessageOut) => {
    if (msg.type === "room_state" && msg.data) {
      set({ roomState: msg.data as unknown as RoomState });
    } else if (msg.type === "round_processing") {
      set({ isProcessing: true });
    } else if (msg.type === "round_started" && msg.data) {
      set({
        roomState: msg.data as unknown as RoomState,
        isProcessing: false,
        stagedContent: "",
      });
    }
  },

  reset: () =>
    set({ roomState: null, sessionId: null, stagedContent: "", isProcessing: false }),
}));
