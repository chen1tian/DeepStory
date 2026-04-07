import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import type { Message } from "../types";

interface Props {
  message: Message;
  isStreaming?: boolean;
  onBranch?: (messageId: string) => void;
}

export default function MessageBubble({ message, isStreaming, onBranch }: Props) {
  return (
    <div className={`message-bubble ${message.role}`}>
      {message.role === "user" ? (
        <div>{message.content}</div>
      ) : (
        <div className={isStreaming ? "streaming-cursor" : ""}>
          <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
            {message.content}
          </ReactMarkdown>
        </div>
      )}
      {onBranch && !isStreaming && (
        <button
          className="branch-btn"
          title="从此处创建分支"
          onClick={() => onBranch(message.id)}
        >
          ⑂
        </button>
      )}
    </div>
  );
}
