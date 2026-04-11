import { create } from "zustand";
import type { Message, TokenBudgetInfo, StateData, WSMessageOut } from "../types";
import { ChatWebSocket } from "../services/websocket";
import { getMessages, getState, deleteMessagesFrom as apiDeleteMessagesFrom } from "../services/api";

interface ChatState {
  messages: Message[];
  activeBranch: string[];
  streamingContent: string;
  isStreaming: boolean;
  tokenBudget: TokenBudgetInfo | null;
  stateData: StateData | null;
  summaryStatus: string;
  error: string | null;
  ws: ChatWebSocket | null;

  // Actions
  connectToSession: (sessionId: string) => void;
  disconnect: () => void;
  sendMessage: (content: string) => void;
  sendBranchMessage: (content: string, fromMessageId: string) => void;
  deleteMessagesFrom: (sessionId: string, messageId: string) => Promise<void>;
  resendMessage: (sessionId: string, message: Message) => Promise<void>;
  loadMessages: (sessionId: string) => Promise<void>;
  loadState: (sessionId: string) => Promise<void>;
  clearError: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  activeBranch: [],
  streamingContent: "",
  isStreaming: false,
  tokenBudget: null,
  stateData: null,
  summaryStatus: "",
  error: null,
  ws: null,

  connectToSession: (sessionId: string) => {
    const prev = get().ws;
    if (prev) prev.close();

    const ws = new ChatWebSocket(sessionId);

    const handler = (msg: WSMessageOut) => {
      switch (msg.type) {
        case "token":
          set((s) => ({
            streamingContent: s.streamingContent + (msg.content || ""),
            isStreaming: true,
          }));
          break;

        case "chat_complete": {
          const { streamingContent, messages } = get();
          if (streamingContent) {
            const newMsg: Message = {
              id: msg.message_id || crypto.randomUUID(),
              parent_id: messages.length > 0 ? messages[messages.length - 1].id : null,
              role: "assistant",
              content: streamingContent,
              timestamp: new Date().toISOString(),
              token_count: 0,
              branch_id: "main",
            };
            set({
              messages: [...messages, newMsg],
              streamingContent: "",
              isStreaming: false,
            });
          }
          break;
        }

        case "token_budget":
          if (msg.data) {
            set({ tokenBudget: msg.data as unknown as TokenBudgetInfo });
          }
          break;

        case "summary_progress":
          set({ summaryStatus: msg.status || "" });
          break;

        case "state_updated":
          if (msg.data) {
            set({ stateData: msg.data as unknown as StateData });
          }
          break;

        case "error":
          set({ error: msg.content || "Unknown error", isStreaming: false, streamingContent: "" });
          break;

        case "pong":
          break;
      }
    };

    ws.onMessage(handler);
    ws.connect();
    set({ ws, messages: [], streamingContent: "", isStreaming: false, error: null });

    // Load initial data
    get().loadMessages(sessionId);
    get().loadState(sessionId);
  },

  disconnect: () => {
    get().ws?.close();
    set({ ws: null });
  },

  sendMessage: (content: string) => {
    const { ws, messages, isStreaming } = get();
    if (!ws || isStreaming) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      parent_id: messages.length > 0 ? messages[messages.length - 1].id : null,
      role: "user",
      content,
      timestamp: new Date().toISOString(),
      token_count: 0,
      branch_id: "main",
    };

    set({ messages: [...messages, userMsg], streamingContent: "", error: null });
    ws.send({ type: "chat", content, connection_id: localStorage.getItem("activeConnectionId"), state_connection_id: localStorage.getItem("stateConnectionId") });
  },

  sendBranchMessage: (content: string, fromMessageId: string) => {
    const { ws, isStreaming } = get();
    if (!ws || isStreaming) return;

    // Trim messages to branch point + add user message
    const { messages } = get();
    const branchIdx = messages.findIndex((m) => m.id === fromMessageId);
    const trimmed = branchIdx >= 0 ? messages.slice(0, branchIdx + 1) : messages;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      parent_id: fromMessageId,
      role: "user",
      content,
      timestamp: new Date().toISOString(),
      token_count: 0,
      branch_id: "main",
    };

    set({ messages: [...trimmed, userMsg], streamingContent: "", error: null });
    ws.send({ type: "chat_from_branch", content, branch_from_message_id: fromMessageId, connection_id: localStorage.getItem("activeConnectionId"), state_connection_id: localStorage.getItem("stateConnectionId") });
  },

  loadMessages: async (sessionId: string) => {
    try {
      const data = await getMessages(sessionId);
      set({ messages: data.messages, activeBranch: data.active_branch });
    } catch {
      // Session may be new with no messages yet
    }
  },

  loadState: async (sessionId: string) => {
    try {
      const state = await getState(sessionId);
      set({ stateData: state });
    } catch {
      // No state yet
    }
  },

  clearError: () => set({ error: null }),

  deleteMessagesFrom: async (sessionId: string, messageId: string) => {
    await apiDeleteMessagesFrom(sessionId, messageId);
    const { messages } = get();
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx >= 0) {
      set({ messages: messages.slice(0, idx) });
    }
  },

  resendMessage: async (sessionId: string, message: Message) => {
    const { ws, isStreaming } = get();
    if (!ws || isStreaming) return;

    // Delete this message and everything after from backend + local state
    await apiDeleteMessagesFrom(sessionId, message.id);
    const { messages } = get();
    const idx = messages.findIndex((m) => m.id === message.id);
    const trimmed = idx >= 0 ? messages.slice(0, idx) : messages;

    // Re-add the user message locally
    const userMsg: Message = {
      id: crypto.randomUUID(),
      parent_id: trimmed.length > 0 ? trimmed[trimmed.length - 1].id : null,
      role: "user",
      content: message.content,
      timestamp: new Date().toISOString(),
      token_count: 0,
      branch_id: "main",
    };
    set({ messages: [...trimmed, userMsg], streamingContent: "", error: null });
    ws.send({ type: "chat", content: message.content, connection_id: localStorage.getItem("activeConnectionId"), state_connection_id: localStorage.getItem("stateConnectionId") });
  },
}));
