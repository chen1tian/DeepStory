import { create } from "zustand";
import type { Message, TokenBudgetInfo, StateData, WSMessageOut, HookResultPayload } from "../types";
import { ChatWebSocket } from "../services/websocket";
import { getMessages, getState, deleteMessagesFrom as apiDeleteMessagesFrom } from "../services/api";
import { useUIStore } from "./uiStore";
import { randomId } from "../utils/randomId";

interface ChatState {
  messages: Message[];
  activeBranch: string[];
  streamingContent: string;
  streamingThinking: string;
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
  // Room actions
  submitTurn: (content: string) => void;
  retractTurn: () => void;
  forceSubmit: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  activeBranch: [],
  streamingContent: "",
  streamingThinking: "",
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
        case "thinking":
          set((s) => ({
            streamingThinking: s.streamingThinking + (msg.content || ""),
            isStreaming: true,
          }));
          break;

        case "token":
          set((s) => ({
            streamingContent: s.streamingContent + (msg.content || ""),
            isStreaming: true,
          }));
          break;

        case "chat_complete": {
          const { streamingContent, streamingThinking, messages } = get();
          if (streamingContent || streamingThinking) {
            const newMsg: Message = {
              id: msg.message_id || randomId(),
              parent_id: messages.length > 0 ? messages[messages.length - 1].id : null,
              role: "assistant",
              content: streamingContent,
              thinking: streamingThinking || undefined,
              timestamp: new Date().toISOString(),
              token_count: 0,
              branch_id: "main",
            };
            set({
              messages: [...messages, newMsg],
              streamingContent: "",
              streamingThinking: "",
              isStreaming: false,
            });
          } else {
            set({ isStreaming: false });
          }
          break;
        }

        case "token_budget":
          if (msg.data) {
            set({ tokenBudget: msg.data as unknown as TokenBudgetInfo });
          }
          break;

        case "summary_progress": {
          const status = msg.status || "";
          // "complete" means done — clear the indicator so the banner disappears
          set({ summaryStatus: status === "complete" ? "" : status });
          break;
        }

        case "state_updated":
          if (msg.data) {
            set({ stateData: msg.data as unknown as StateData });
          }
          break;

        case "hook_result": {
          if (msg.data) {
            const payload = msg.data as unknown as HookResultPayload;
            // Lazy import to avoid circular dep
            import("./hookStore").then(({ useHookStore }) => {
              useHookStore.getState().setResult(payload.hook_id, payload);
            });
          }
          break;
        }

        case "narrator_update": {
          if (msg.data) {
            import("./narratorStore").then(({ useNarratorStore }) => {
              useNarratorStore.getState().handleNarratorUpdate(
                sessionId,
                msg.data as unknown as import("../types").NarratorUpdatePayload,
              );
            });
          }
          break;
        }

        case "room_state":
        case "round_processing":
          import("./roomStore").then(({ useRoomStore }) => {
            useRoomStore.getState().handleRoomMessage(msg);
          });
          break;

        case "round_started":
          import("./roomStore").then(({ useRoomStore }) => {
            useRoomStore.getState().handleRoomMessage(msg);
          });
          // Reload messages so the combined user turn appears
          get().loadMessages(sessionId);
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
    if (!ws) throw new Error("WebSocket 未连接");
    if (isStreaming) throw new Error("正在生成回复中，请等待完成后再发送");

    const userMsg: Message = {
      id: randomId(),
      parent_id: messages.length > 0 ? messages[messages.length - 1].id : null,
      role: "user",
      content,
      timestamp: new Date().toISOString(),
      token_count: 0,
      branch_id: "main",
    };

    set({ messages: [...messages, userMsg], streamingContent: "", error: null });
    // Clear previous hook results when a new message is sent
    import("./hookStore").then(({ useHookStore }) => {
      useHookStore.getState().clearResults();
    });
    ws.send({ type: "chat", content, connection_id: localStorage.getItem("activeConnectionId"), state_connection_id: localStorage.getItem("stateConnectionId"), context_max_tokens: useUIStore.getState().contextLength });
  },

  sendBranchMessage: (content: string, fromMessageId: string) => {
    const { ws, isStreaming } = get();
    if (!ws) throw new Error("WebSocket 未连接");
    if (isStreaming) throw new Error("正在生成回复中，请等待完成后再发送");

    // Trim messages to branch point + add user message
    const { messages } = get();
    const branchIdx = messages.findIndex((m) => m.id === fromMessageId);
    const trimmed = branchIdx >= 0 ? messages.slice(0, branchIdx + 1) : messages;

    const userMsg: Message = {
      id: randomId(),
      parent_id: fromMessageId,
      role: "user",
      content,
      timestamp: new Date().toISOString(),
      token_count: 0,
      branch_id: "main",
    };

    set({ messages: [...trimmed, userMsg], streamingContent: "", error: null });
    // Clear previous hook results when a new message is sent
    import("./hookStore").then(({ useHookStore }) => {
      useHookStore.getState().clearResults();
    });
    ws.send({ type: "chat_from_branch", content, branch_from_message_id: fromMessageId, connection_id: localStorage.getItem("activeConnectionId"), state_connection_id: localStorage.getItem("stateConnectionId"), context_max_tokens: useUIStore.getState().contextLength });
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
    if (!ws) throw new Error("WebSocket 未连接");
    if (isStreaming) throw new Error("正在生成回复中，请等待完成后再重发");

    // Delete this message and everything after from backend + local state
    await apiDeleteMessagesFrom(sessionId, message.id);
    const { messages } = get();
    const idx = messages.findIndex((m) => m.id === message.id);
    const trimmed = idx >= 0 ? messages.slice(0, idx) : messages;

    // Re-add the user message locally
    const userMsg: Message = {
      id: randomId(),
      parent_id: trimmed.length > 0 ? trimmed[trimmed.length - 1].id : null,
      role: "user",
      content: message.content,
      timestamp: new Date().toISOString(),
      token_count: 0,
      branch_id: "main",
    };
    set({ messages: [...trimmed, userMsg], streamingContent: "", error: null });
    ws.send({ type: "chat", content: message.content, connection_id: localStorage.getItem("activeConnectionId"), state_connection_id: localStorage.getItem("stateConnectionId"), context_max_tokens: useUIStore.getState().contextLength });
  },

  submitTurn: (content: string) => {
    const { ws } = get();
    if (!ws) return;
    ws.send({ type: "submit_turn", content, connection_id: localStorage.getItem("activeConnectionId"), state_connection_id: localStorage.getItem("stateConnectionId"), context_max_tokens: useUIStore.getState().contextLength });
  },

  retractTurn: () => {
    const { ws } = get();
    if (!ws) return;
    ws.send({ type: "retract_turn", content: "" });
  },

  forceSubmit: () => {
    const { ws } = get();
    if (!ws) return;
    ws.send({ type: "force_submit", content: "", connection_id: localStorage.getItem("activeConnectionId"), state_connection_id: localStorage.getItem("stateConnectionId"), context_max_tokens: useUIStore.getState().contextLength });
  },
}));
