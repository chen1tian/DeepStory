import { useCallback } from "react";
import { useSessionStore } from "../stores/sessionStore";
import { useChatStore } from "../stores/chatStore";
import { useUIStore } from "../stores/uiStore";
import { useRoomStore } from "../stores/roomStore";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import TokenBudgetBar from "./TokenBudgetBar";
import SceneActions from "./SceneActions";
import HookResultPanel from "./HookResultPanel";
import RoomPanel from "./RoomPanel";
import { branchFromMessage } from "../services/api";

const PLAYER_COLORS = [
  "border-indigo-500/40 bg-indigo-500/10 text-indigo-300",
  "border-violet-500/40 bg-violet-500/10 text-violet-300",
  "border-sky-500/40 bg-sky-500/10 text-sky-300",
  "border-teal-500/40 bg-teal-500/10 text-teal-300",
  "border-rose-500/40 bg-rose-500/10 text-rose-300",
  "border-amber-500/40 bg-amber-500/10 text-amber-300",
];

function PendingTurnsDisplay() {
  const roomState = useRoomStore((s) => s.roomState);
  const isProcessing = useRoomStore((s) => s.isProcessing);

  if (!roomState) return null;
  const hasPending = Object.keys(roomState.pending_turns).length > 0;
  if (!hasPending && !isProcessing) return null;

  return (
    <div className="px-4 md:px-6 pb-3 flex flex-col gap-2">
      <div className="text-[11px] text-[var(--text-secondary)] uppercase tracking-wider mb-0.5">
        {isProcessing ? "DM 正在处理..." : "本轮行动预览"}
      </div>
      {roomState.players.map((player, i) => {
        const content = roomState.pending_turns[player.user_id];
        if (!content) return null;
        const color = PLAYER_COLORS[i % PLAYER_COLORS.length];
        return (
          <div
            key={player.user_id}
            className={`flex flex-col items-end animate-in fade-in slide-in-from-bottom-1 duration-200 ${isProcessing ? "opacity-60" : ""}`}
          >
            <span className="text-[11px] text-[var(--text-secondary)] mb-0.5 mr-1">
              {player.username}
            </span>
            <div
              className={`max-w-[80%] px-3 py-2 rounded-xl rounded-tr-sm text-[14px] leading-relaxed whitespace-pre-wrap border ${color}`}
            >
              {content}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ChatView() {
  const currentSessionId = useSessionStore((s) => s.currentSessionId);
  const sendBranchMessage = useChatStore((s) => s.sendBranchMessage);
  const deleteMessagesFrom = useChatStore((s) => s.deleteMessagesFrom);
  const resendMessage = useChatStore((s) => s.resendMessage);
  const messages = useChatStore((s) => s.messages);
  const addToast = useUIStore((s) => s.addToast);

  const handleBranch = useCallback(
    async (messageId: string) => {
      if (!currentSessionId) return;
      try {
        await branchFromMessage(currentSessionId, messageId);
        const content = prompt("输入新分支的内容:");
        if (content) {
          sendBranchMessage(content, messageId);
        }
      } catch (err) {
        addToast("创建分支失败", "error");
      }
    },
    [currentSessionId, sendBranchMessage, addToast]
  );

  const handleDelete = useCallback(
    async (messageId: string) => {
      if (!currentSessionId) return;
      try {
        await deleteMessagesFrom(currentSessionId, messageId);
      } catch {
        addToast("删除消息失败", "error");
      }
    },
    [currentSessionId, deleteMessagesFrom, addToast]
  );

  const handleResend = useCallback(
    async (messageId: string) => {
      if (!currentSessionId) return;
      const msg = messages.find((m) => m.id === messageId);
      if (!msg) return;
      try {
        await resendMessage(currentSessionId, msg);
      } catch {
        addToast("重发消息失败", "error");
      }
    },
    [currentSessionId, messages, resendMessage, addToast]
  );

  if (!currentSessionId) {
    return (
      <div className="flex bg-[var(--bg-primary)] h-full items-center justify-center text-center text-gray-500">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center text-3xl mb-4 shadow-inner">
            💬
          </div>
          <h2 className="text-xl font-semibold text-gray-200 mb-1">未选择对话</h2>
          <p className="text-sm">在侧边栏选择或新建一个对话以开启创作之旅</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full bg-[var(--bg-primary)]">
      <RoomPanel />
      <MessageList onBranch={handleBranch} onDelete={handleDelete} onResend={handleResend} />
      <PendingTurnsDisplay />
      <SceneActions />
      <HookResultPanel />
      <div className="w-full relative shadow-[0_-20px_40px_-5px_rgba(26,26,46,0.9)]">
        <MessageInput />
        <TokenBudgetBar />
      </div>
    </div>
  );
}
