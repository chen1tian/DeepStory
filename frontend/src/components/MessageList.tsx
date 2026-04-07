import { useRef, useEffect } from "react";
import MessageBubble from "./MessageBubble";
import { useChatStore } from "../stores/chatStore";

interface Props {
  onBranch: (messageId: string) => void;
}

export default function MessageList({ onBranch }: Props) {
  const messages = useChatStore((s) => s.messages);
  const streamingContent = useChatStore((s) => s.streamingContent);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const summaryStatus = useChatStore((s) => s.summaryStatus);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  return (
    <div className="chat-area">
      {messages.length === 0 && !isStreaming && (
        <div className="empty-state">
          <div className="icon">✏️</div>
          <p>开始你的创作之旅</p>
          <p style={{ fontSize: 13 }}>输入你的想法，AI 将协助你创作</p>
        </div>
      )}

      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} onBranch={onBranch} />
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
        <div className="summary-status">
          {summaryStatus === "summarizing" ? "🔄 正在生成摘要..." : "🔄 正在提取状态..."}
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
