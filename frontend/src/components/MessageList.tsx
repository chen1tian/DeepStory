import { useRef, useEffect, useState } from "react";
import MessageBubble from "./MessageBubble";
import { useChatStore } from "../stores/chatStore";
import { useSessionStore } from "../stores/sessionStore";
import { useUserProtagonistStore } from "../stores/userProtagonistStore";

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
  const currentSessionId = useSessionStore((s) => s.currentSessionId);
  const sessions = useSessionStore((s) => s.sessions);
  const userProtagonists = useUserProtagonistStore((s) => s.userProtagonists);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const fetchUserProtagonists = useUserProtagonistStore((s) => s.fetchUserProtagonists);

  useEffect(() => {
    if (userProtagonists.length === 0) {
      fetchUserProtagonists();
    }
  }, [userProtagonists.length, fetchUserProtagonists]);

  const session = currentSessionId ? sessions.find((s) => s.id === currentSessionId) : null;
  const sessionCharacters = session?.characters ?? [];
  const protagonist = session?.user_protagonist_id
    ? userProtagonists.find((p) => p.id === session.user_protagonist_id)
    : null;

  const pendingDeleteIdx = pendingDeleteId
    ? messages.findIndex((m) => m.id === pendingDeleteId)
    : -1;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6 md:py-8 flex flex-col gap-6 scroll-smooth minimal-scrollbar">
      {messages.length === 0 && !isStreaming && (
        <div className="m-auto flex flex-col items-center justify-center text-center text-[var(--text-secondary)] mt-20 space-y-3">
          <div className="text-5xl mb-2 opacity-80 drop-shadow-lg">✨</div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">开启创作之旅</h2>
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
            sessionCharacters={sessionCharacters}
            protagonistAvatarUrl={protagonist?.avatar_url ?? null}
            protagonistAvatarEmoji={protagonist?.avatar_emoji ?? "🧑"}
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
            sessionCharacters={sessionCharacters}
          />
        )}

        {summaryStatus && (
          <div className="flex w-full justify-center">
            <div className="bg-blue-500/10 text-blue-400 px-4 py-2 rounded-full text-xs font-medium animate-pulse ring-1 ring-inset ring-blue-500/20 backdrop-blur-sm shadow-sm">
              {summaryStatus === "summarizing" ? "🔄 正在提炼上下文记忆..." : "🔄 正在提取情境状态..."}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
    </div>
  );
}
