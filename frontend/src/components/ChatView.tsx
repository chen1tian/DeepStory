import { useState, useCallback } from "react";
import { useSessionStore } from "../stores/sessionStore";
import { useChatStore } from "../stores/chatStore";
import { useUIStore } from "../stores/uiStore";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import TokenBudgetBar from "./TokenBudgetBar";
import SceneActions from "./SceneActions";
import { branchFromMessage } from "../services/api";

export default function ChatView() {
  const currentSessionId = useSessionStore((s) => s.currentSessionId);
  const sendBranchMessage = useChatStore((s) => s.sendBranchMessage);
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

  if (!currentSessionId) {
    return (
      <div className="empty-state">
        <div className="icon">💬</div>
        <p>选择或新建一个对话开始创作</p>
      </div>
    );
  }

  return (
    <>
      <MessageList onBranch={handleBranch} />
      <SceneActions />
      <div className="input-area">
        <MessageInput />
        <TokenBudgetBar />
      </div>
    </>
  );
}
