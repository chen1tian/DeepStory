import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import type { Message } from "../types";

interface Props {
  message: Message;
  isStreaming?: boolean;
  isPendingDelete?: boolean;
  isConfirming?: boolean;
  onBranch?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onResend?: (messageId: string) => void;
  onConfirmStart?: () => void;
  onConfirmCancel?: () => void;
}

export default function MessageBubble({
  message, isStreaming, isPendingDelete, isConfirming,
  onBranch, onDelete, onResend, onConfirmStart, onConfirmCancel,
}: Props) {
  const isUser = message.role === "user";

  const hasActions = (onBranch || onDelete || (onResend && isUser)) && !isStreaming;

  return (
    <div
      className={`flex flex-col w-full transition-all duration-200 ${
        isUser ? "items-end" : "items-start"
      } group animate-in fade-in slide-in-from-bottom-2 duration-300 ${
        isPendingDelete ? "opacity-40 scale-[0.99]" : ""
      }`}
      onMouseLeave={() => onConfirmCancel?.()}
    >
      {/* 气泡本体 */}
      <div
        className={`relative px-5 py-3.5 max-w-[90%] md:max-w-[75%] text-[15px] leading-7 break-words shadow-sm transition-all ${
          isPendingDelete
            ? isUser
              ? "bg-red-900/40 text-indigo-100 rounded-2xl rounded-tr-sm border border-red-500/50"
              : "bg-red-950/30 text-gray-300 border border-red-500/40 rounded-2xl rounded-tl-sm"
            : isUser
              ? "bg-indigo-600 text-indigo-50 rounded-2xl rounded-tr-sm border border-indigo-500/50 hover:shadow-md"
              : "bg-[var(--bg-surface)] text-gray-200 border border-[var(--border)] rounded-2xl rounded-tl-sm hover:border-gray-600 hover:bg-[#202c4f]"
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <div
            className={`prose prose-invert prose-p:my-2 prose-pre:my-3 prose-a:text-indigo-400 prose-code:text-indigo-200 prose-code:bg-black/30 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded max-w-none ${
              isStreaming ? "streaming-cursor" : ""
            }`}
          >
            <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* 操作栏 */}
      {hasActions && (
        <div
          className={`flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${
            isUser ? "flex-row-reverse" : "flex-row"
          }`}
        >
          {/* 分支按钮 */}
          {onBranch && (
            <button
              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/30 transition-all"
              title="从此处分支出发"
              onClick={() => onBranch(message.id)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v12"/><path d="M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M15 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M12 12c-2.76 0-5 2.24-5 5"/></svg>
              分支
            </button>
          )}

          {/* 重发按钮（仅用户消息） */}
          {onResend && isUser && (
            <button
              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/30 transition-all"
              title="重新发送此消息"
              onClick={() => onResend(message.id)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              重发
            </button>
          )}

          {/* 删除按钮（两步确认） */}
          {onDelete && (
            isConfirming ? (
              <button
                className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-red-400 bg-red-500/10 border border-red-500/40 hover:bg-red-500/20 transition-all"
                title="确认删除此条及之后所有消息"
                onClick={() => { onDelete(message.id); onConfirmCancel?.(); }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                确认删除
              </button>
            ) : (
              <button
                className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-all"
                title="删除此条及之后所有消息"
                onClick={() => onConfirmStart?.()}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                删除
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
