import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import type { Message } from "../types";

interface Props {
  message: Message;
  isStreaming?: boolean;
  onBranch?: (messageId: string) => void;
}

export default function MessageBubble({ message, isStreaming, onBranch }: Props) {
  const isUser = message.role === "user";
  
  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"} group relative animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      {/* 气泡本体 */}
      <div 
        className={`relative px-5 py-3.5 max-w-[90%] md:max-w-[75%] text-[15px] leading-7 break-words shadow-sm transition-all ${
          isUser 
            ? "bg-indigo-600 text-indigo-50 rounded-2xl rounded-tr-sm border border-indigo-500/50 hover:shadow-md" 
            : "bg-[var(--bg-surface)] text-gray-200 border border-[var(--border)] rounded-2xl rounded-tl-sm hover:border-gray-600 hover:bg-[#202c4f]"
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <div className={`prose prose-invert prose-p:my-2 prose-pre:my-3 prose-a:text-indigo-400 prose-code:text-indigo-200 prose-code:bg-black/30 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded max-w-none ${isStreaming ? "streaming-cursor" : ""}`}>
            <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        
        {/* 分支按钮，做成浮动圆钮 */}
        {onBranch && !isStreaming && (
          <button
            className={`absolute top-1/2 -translate-y-1/2 ${isUser ? '-left-10' : '-right-10'} w-8 h-8 flex items-center justify-center rounded-full bg-[var(--bg-secondary)] border border-[var(--border)] text-gray-400 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/10 shadow-sm opacity-0 group-hover:opacity-100 transition-all focus:opacity-100 scale-90 group-hover:scale-100 z-10`}
            title="从此处分支出发"
            onClick={() => onBranch(message.id)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v12"/><path d="M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M15 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M12 12c-2.76 0-5 2.24-5 5"/></svg>
          </button>
        )}
      </div>
    </div>
  );
}
