import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import type { Message, SessionCharacter } from "../types";

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
  /** Session characters for avatar lookup in multi-player messages */
  sessionCharacters?: SessionCharacter[];
  /** Protagonist avatar (URL or emoji) for user messages */
  protagonistAvatarUrl?: string | null;
  protagonistAvatarEmoji?: string;
}

/** Parse combined multiplayer turns like "[Alice]: hello\n[Bob]: world" */
function parseMultiplayerTurns(content: string): { name: string; text: string }[] | null {
  const lines = content.split("\n");
  const turns: { name: string; text: string }[] = [];
  let current: { name: string; lines: string[] } | null = null;
  for (const line of lines) {
    const m = line.match(/^\[([^\]]+)\]:\s*(.*)/);
    if (m) {
      if (current) turns.push({ name: current.name, text: current.lines.join("\n").trim() });
      current = { name: m[1], lines: [m[2]] };
    } else if (current) {
      current.lines.push(line);
    } else {
      return null; // Not a multiplayer message
    }
  }
  if (current) turns.push({ name: current.name, text: current.lines.join("\n").trim() });
  return turns.length > 1 ? turns : null; // Only parse if 2+ players
}

const PLAYER_COLORS = [
  "bg-indigo-600 ring-indigo-500/30",
  "bg-violet-600 ring-violet-500/30",
  "bg-sky-600 ring-sky-500/30",
  "bg-teal-600 ring-teal-500/30",
  "bg-rose-600 ring-rose-500/30",
  "bg-amber-600 ring-amber-500/30",
];

function findCharacterAvatar(name: string, characters: SessionCharacter[]): { url: string | null; emoji: string } | null {
  const match = characters.find(
    (c) => c.name === name || c.name.toLowerCase() === name.toLowerCase()
  );
  if (match) return { url: match.avatar_url, emoji: match.avatar_emoji };
  return null;
}

/** Extract <think>...</think> blocks from content. Handles partial tags during streaming. */
function parseThinking(content: string): { thinking: string; rest: string } {
  // Complete <think>...</think> blocks
  const completeRegex = /<think>([\s\S]*?)<\/think>/gi;
  const parts: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = completeRegex.exec(content)) !== null) {
    if (m[1].trim()) parts.push(m[1].trim());
  }
  let working = content.replace(completeRegex, "");

  // Handle partial opening tag during streaming: <think> without </think>
  const openIdx = working.search(/<think>/i);
  if (openIdx !== -1) {
    const afterOpen = working.slice(openIdx + 7); // length of "<think>"
    const closeIdx = afterOpen.search(/<\/think>/i);
    if (closeIdx === -1) {
      // No closing tag yet — streaming in progress
      const partial = afterOpen.trim();
      if (partial) parts.push(partial);
      working = working.slice(0, openIdx);
    }
  }

  const rest = working.trim();
  return { thinking: parts.join("\n\n"), rest };
}

export default function MessageBubble({
  message, isStreaming, isPendingDelete, isConfirming,
  onBranch, onDelete, onResend, onConfirmStart, onConfirmCancel,
  sessionCharacters, protagonistAvatarUrl, protagonistAvatarEmoji,
}: Props) {
  const isUser = message.role === "user";

  const hasActions = (onBranch || onDelete || (onResend && isUser)) && !isStreaming;

  // Multi-player aggregated message
  const multiTurns = isUser ? parseMultiplayerTurns(message.content) : null;

  // Avatar for single user message
  const userAvatar = isUser
    ? (protagonistAvatarUrl ? { url: protagonistAvatarUrl, emoji: protagonistAvatarEmoji || "🧑" } : null)
    : null;

  // Use dedicated thinking field (from API) or fall back to parsing <think> tags
  const thinking = !isUser ? (message.thinking || parseThinking(message.content).thinking) : "";
  const cleanContent = !isUser ? parseThinking(message.content).rest : message.content;

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
      {multiTurns ? (
        <div className="flex flex-col gap-2 max-w-[92%] md:max-w-[80%]">
          {multiTurns.map((turn, i) => {
            const charAvatar = sessionCharacters ? findCharacterAvatar(turn.name, sessionCharacters) : null;
            return (
              <div key={i} className="flex items-end gap-2 justify-end">
                <div className="flex flex-col items-end">
                  <span className="text-[11px] text-[var(--text-secondary)] mb-0.5 mr-1">{turn.name}</span>
                  <div
                    className={`relative px-3 py-2 text-[15px] leading-[1.8] break-words whitespace-pre-wrap text-white rounded-xl rounded-tr-sm shadow-sm ring-1 ring-inset ${PLAYER_COLORS[i % PLAYER_COLORS.length]}`}
                  >
                    {turn.text}
                  </div>
                </div>
                {charAvatar?.url ? (
                  <img src={charAvatar.url} alt="" className="w-14 h-14 rounded-full object-cover flex-shrink-0 mb-0.5" />
                ) : (
                  <span className="text-3xl mb-0.5">{charAvatar?.emoji || "🧑"}</span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
          {/* Assistant avatar (left side) */}
          {!isUser && (
            <div className="w-14 h-14 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0 mb-0.5 ring-1 ring-inset ring-indigo-500/20">
              <span className="text-2xl">🤖</span>
            </div>
          )}

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
              <div className="w-full">
                {thinking && (
                  <details
                    className="thinking-block mb-2 bg-amber-500/5 border border-amber-500/20 rounded-lg overflow-hidden"
                    open={isStreaming}
                  >
                    <summary className="thinking-summary px-3 py-1.5 text-[11px] font-medium text-amber-400/80 cursor-pointer hover:text-amber-300 select-none flex items-center gap-1.5">
                      <span className="text-[13px]">🧠</span> 思考过程
                      <span className="text-[10px] text-amber-500/50 ml-auto">{isStreaming ? "思考中..." : "点击展开/收起"}</span>
                    </summary>
                    <div className="thinking-content px-3 pb-3 pt-1 text-[12px] text-amber-300/70 leading-relaxed whitespace-pre-wrap border-t border-amber-500/10">
                      {thinking}
                    </div>
                  </details>
                )}
                {cleanContent ? (
                  <div
                    className={`prose prose-invert prose-p:my-1 prose-p:first:mt-0 prose-p:last:mb-0 prose-pre:my-2 prose-a:text-indigo-400 prose-code:text-indigo-200 prose-code:bg-black/30 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-md max-w-none ${
                      isStreaming && !thinking ? "streaming-cursor" : ""
                    }`}
                  >
                    <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                      {cleanContent}
                    </ReactMarkdown>
                  </div>
                ) : (
                  isStreaming && thinking && (
                    <div className="text-[13px] text-[var(--text-secondary)] animate-pulse">生成回复中...</div>
                  )
                )}
              </div>
            )}
          </div>

          {/* User avatar (right side) */}
          {isUser && userAvatar && (
            userAvatar.url ? (
              <img src={userAvatar.url} alt="" className="w-14 h-14 rounded-full object-cover flex-shrink-0 mb-0.5 ring-1 ring-inset ring-white/10" />
            ) : (
              <span className="text-3xl mb-0.5">{userAvatar.emoji}</span>
            )
          )}
        </div>
      )}

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
