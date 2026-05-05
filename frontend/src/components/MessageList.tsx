import { useRef, useEffect, useState, useMemo } from "react";
import MessageBubble from "./MessageBubble";
import { useChatStore } from "../stores/chatStore";
import { useSessionStore } from "../stores/sessionStore";
import { useUserProtagonistStore } from "../stores/userProtagonistStore";
import { useUIStore } from "../stores/uiStore";
import { useRoomStore } from "../stores/roomStore";

interface Props {
  onDelete: (messageId: string) => void;
  onResend: (messageId: string) => void;
}

export default function MessageList({ onDelete, onResend }: Props) {
  const messages = useChatStore((s) => s.messages);
  const streamingContent = useChatStore((s) => s.streamingContent);
  const streamingThinking = useChatStore((s) => s.streamingThinking);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const summaryStatus = useChatStore((s) => s.summaryStatus);
  const tokenBudget = useChatStore((s) => s.tokenBudget);
  const currentSessionId = useSessionStore((s) => s.currentSessionId);
  const sessions = useSessionStore((s) => s.sessions);
  const userProtagonists = useUserProtagonistStore((s) => s.userProtagonists);
  const maxMessageCount = useUIStore((s) => s.maxMessageCount);
  const roomPlayers = useRoomStore((s) => s.roomState?.players ?? []);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

  const fetchUserProtagonists = useUserProtagonistStore((s) => s.fetchUserProtagonists);

  const isNearBottom = () => {
    const container = scrollContainerRef.current;
    if (!container) return true;
    return container.scrollHeight - container.scrollTop - container.clientHeight <= 80;
  };

  useEffect(() => {
    if (userProtagonists.length === 0) {
      fetchUserProtagonists();
    }
  }, [userProtagonists.length, fetchUserProtagonists]);

  const displayMessages = useMemo(() => {
    if (maxMessageCount > 0 && messages.length > maxMessageCount) {
      return messages.slice(messages.length - maxMessageCount);
    }
    return messages;
  }, [messages, maxMessageCount]);

  const session = currentSessionId ? sessions.find((s) => s.id === currentSessionId) : null;
  const sessionCharacters = session?.characters ?? [];
  const protagonist = session?.user_protagonist_id
    ? userProtagonists.find((p) => p.id === session.user_protagonist_id)
    : null;

  const pendingDeleteDisplayIdx = pendingDeleteId
    ? displayMessages.findIndex((m) => m.id === pendingDeleteId)
    : -1;

  useEffect(() => {
    setAutoScrollEnabled(true);
  }, [currentSessionId]);

  useEffect(() => {
    if (messages[messages.length - 1]?.role === "user") {
      setAutoScrollEnabled(true);
    }
  }, [messages]);

  useEffect(() => {
    if (!autoScrollEnabled) return;
    bottomRef.current?.scrollIntoView({ behavior: isStreaming ? "auto" : "smooth" });
  }, [autoScrollEnabled, messages, streamingContent, streamingThinking, isStreaming]);

  const handleScroll = () => {
    setAutoScrollEnabled(isNearBottom());
  };

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 py-6 md:px-6 md:py-8 flex flex-col gap-6 scroll-smooth minimal-scrollbar"
    >
      {displayMessages.length === 0 && !isStreaming && (
        <div className="m-auto flex flex-col items-center justify-center text-center text-[var(--text-secondary)] mt-20 space-y-3">
          <div className="text-5xl mb-2 opacity-80 drop-shadow-lg">✨</div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">开启创作之旅</h2>
          <p className="text-sm max-w-sm">尽情挥洒你的灵感，AI 将在每一步协助你构建宏大故事。</p>
        </div>
      )}

        {displayMessages.map((msg, idx) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onDelete={onDelete}
            onResend={onResend}
            isPendingDelete={pendingDeleteDisplayIdx >= 0 && idx >= pendingDeleteDisplayIdx}
            isConfirming={pendingDeleteId === msg.id}
            onConfirmStart={() => setPendingDeleteId(msg.id)}
            onConfirmCancel={() => setPendingDeleteId(null)}
            sessionCharacters={sessionCharacters}
            roomPlayers={roomPlayers}
            protagonistAvatarUrl={protagonist?.avatar_url ?? null}
            protagonistAvatarEmoji={protagonist?.avatar_emoji ?? "🧑"}
          />
        ))}

        {isStreaming && (streamingContent || streamingThinking) && (
          <MessageBubble
            message={{
              id: "__streaming__",
              parent_id: null,
              role: "assistant",
              content: streamingContent,
              thinking: streamingThinking || undefined,
              timestamp: "",
              token_count: 0,
              branch_id: "",
            }}
            isStreaming
            sessionCharacters={sessionCharacters}
            roomPlayers={roomPlayers}
          />
        )}

        {isStreaming && !streamingContent && !streamingThinking && (
          <div className="flex items-center justify-center gap-2.5 py-4">
            <div className="flex gap-1">
              <div className="w-2.5 h-2.5 bg-indigo-400/60 rounded-full thinking-dot" />
              <div className="w-2.5 h-2.5 bg-indigo-400/60 rounded-full thinking-dot" />
              <div className="w-2.5 h-2.5 bg-indigo-400/60 rounded-full thinking-dot" />
            </div>
            <span className="text-[14px] text-indigo-400/50 font-medium animate-pulse">正在思考…</span>
          </div>
        )}

        {summaryStatus && (
          <div className="flex w-full justify-center">
            <div className="bg-blue-500/10 text-blue-400 px-4 py-2 rounded-full text-xs font-medium animate-pulse ring-1 ring-inset ring-blue-500/20 backdrop-blur-sm shadow-sm">
              {summaryStatus === "summarizing" ? "🔄 正在提炼上下文记忆..." : "🔄 正在提取情境状态..."}
            </div>
          </div>
        )}

        {tokenBudget && tokenBudget.total > 0 && (
          <div className="flex w-full justify-center pb-1">
            <span className="text-[11px] text-[var(--text-secondary)]/50">
              发送 {tokenBudget.prompt_tokens.toLocaleString()} tokens · 上限 {tokenBudget.total.toLocaleString()} tokens · {messages.length} 条消息
            </span>
          </div>
        )}

        <div ref={bottomRef} />
    </div>
  );
}
