import { useRef, useEffect, useState } from "react";
import MessageBubble from "./MessageBubble";
import { useChatStore } from "../stores/chatStore";

interface Props {
  onBranch: (messageId: string) => void;
  onDelete: (messageId: string) => void;
  onResend: (messageId: string) => void;
}

export default function MessageList({ onBranch, onDelete, onResend }: Props) {
  const messages = useChatStore((s) => s.messages);
  const streamingContent = useChatStore((s) => s.streamingContent);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const summaryStatus = useChatStore((s) => s.summaryStatus);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const pendingDeleteIdx = pendingDeleteId
    ? messages.findIndex((m) => m.id === pendingDeleteId)
    : -1;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col gap-6 scroll-smooth minimal-scrollbar">
      {messages.length === 0 && !isStreaming && (
        <div className="m-auto flex flex-col items-center justify-center text-center text-gray-400 mt-20 space-y-3">
          <div className="text-5xl mb-2 opacity-80 drop-shadow-lg">✨</div>
          <h2 className="text-xl font-semibold text-gray-200">开启创作之旅</h2>
          <p className="text-sm max-w-sm">尽情挥洒你的灵感，AI 将在每一步协助你构建宏大故事。</p>
        </div>
      )}

      {messages.map((msg, idx) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          onBranch={onBranch}
          onDelete={onDelete}
          onResend={onResend}
          isPendingDelete={pendingDeleteIdx >= 0 && idx >= pendingDeleteIdx}
          isConfirming={pendingDeleteId === msg.id}
          onConfirmStart={() => setPendingDeleteId(msg.id)}
          onConfirmCancel={() => setPendingDeleteId(null)}
        />
      ))}

      {isStreaming && streamingContent && (
        <MessageBubble
          message={{
            id: "__streaming__",
            parent_id: null,
            role: "assistant",
            content: streamingContent,
            timestamp: "",
            token_count: 0,
            branch_id: "",
          }}
          isStreaming
        />
      )}

      {summaryStatus && (
        <div className="flex w-full justify-center">
           <div className="bg-indigo-500/20 text-indigo-300 px-4 py-2 rounded-full text-xs font-medium animate-pulse border border-indigo-500/30 backdrop-blur-sm shadow-lg">
             {summaryStatus === "summarizing" ? "🔄 正在提炼上下文记忆..." : "🔄 正在提取情境状态..."}
           </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
