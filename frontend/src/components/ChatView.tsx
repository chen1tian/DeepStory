import { useCallback } from "react";
import { useSessionStore } from "../stores/sessionStore";
import { useChatStore } from "../stores/chatStore";
import { useUIStore } from "../stores/uiStore";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import TokenBudgetBar from "./TokenBudgetBar";
import SceneActions from "./SceneActions";
import HookResultPanel from "./HookResultPanel";
import { branchFromMessage } from "../services/api";

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
      <MessageList onBranch={handleBranch} onDelete={handleDelete} onResend={handleResend} />
      <SceneActions />
      <HookResultPanel />
      <div className="w-full relative shadow-[0_-20px_40px_-5px_rgba(26,26,46,0.9)]">
        <MessageInput />
        <TokenBudgetBar />
      </div>
    </div>
  );
}
