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
        className={`relative px-2 py-2 max-w-[92%] md:max-w-[80%] text-[15px] leading-[1.8] break-words transition-all ${
          isPendingDelete
            ? isUser
              ? "bg-red-900/30 text-red-100 rounded-xl rounded-tr-sm border border-red-500/40"
              : "bg-red-950/20 text-gray-300 border border-red-500/30 rounded-xl rounded-tl-sm"
            : isUser
              ? "bg-blue-600 text-white rounded-xl rounded-tr-sm shadow-sm ring-1 ring-inset ring-white/10"
              : "bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-xl rounded-tl-sm shadow-sm ring-1 ring-inset ring-white/5 hover:bg-white/[0.04] hover:ring-white/10"
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <div
            className={`prose prose-invert prose-p:my-1 prose-p:first:mt-0 prose-p:last:mb-0 prose-pre:my-2 prose-a:text-indigo-400 prose-code:text-indigo-200 prose-code:bg-black/30 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-md max-w-none ${
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
          className={`flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity ${
            isUser ? "flex-row-reverse" : "flex-row"
          }`}
        >
          {/* 分支按钮 */}
          {onBranch && (
            <button
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-white hover:bg-white/10 transition-all border border-transparent hover:border-white/5"
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
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-emerald-400 hover:bg-emerald-500/10 transition-all border border-transparent hover:border-emerald-500/20"
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
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-all shadow-sm"
                title="确认删除此条及之后所有消息"
                onClick={() => { onDelete(message.id); onConfirmCancel?.(); }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                确认删除
              </button>
            ) : (
              <button
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20"
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
