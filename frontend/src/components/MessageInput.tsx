import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import { useChatStore } from "../stores/chatStore";
import { useRoomStore } from "../stores/roomStore";
import { useAuthStore } from "../stores/authStore";

export default function MessageInput() {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const submitTurn = useChatStore((s) => s.submitTurn);
  const retractTurn = useChatStore((s) => s.retractTurn);
  const forceSubmit = useChatStore((s) => s.forceSubmit);
  const isStreaming = useChatStore((s) => s.isStreaming);

  const roomState = useRoomStore((s) => s.roomState);
  const isProcessing = useRoomStore((s) => s.isProcessing);
  const stagedContent = useRoomStore((s) => s.stagedContent);
  const setStagedContent = useRoomStore((s) => s.setStagedContent);
  const user = useAuthStore((s) => s.user);

  const isRoomMode = roomState !== null;
  const isHost = isRoomMode && user?.id === roomState?.host_user_id;
  const myPlayer = roomState?.players.find((p) => p.user_id === user?.id);
  const hasSubmitted = myPlayer?.has_submitted ?? false;

  // Normal send (solo)
  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    sendMessage(trimmed);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "42px";
    }
  }, [text, isStreaming, sendMessage]);

  // Room: submit turn
  const handleSubmit = useCallback(() => {
    const trimmed = stagedContent.trim();
    if (!trimmed || isProcessing) return;
    submitTurn(trimmed);
  }, [stagedContent, isProcessing, submitTurn]);

  // Room: retract turn
  const handleRetract = useCallback(() => {
    retractTurn();
    setStagedContent("");
  }, [retractTurn, setStagedContent]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isRoomMode) {
        if (!hasSubmitted) handleSubmit();
      } else {
        handleSend();
      }
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "42px";
      el.style.height = Math.min(el.scrollHeight, 160) + "px";
    }
  };

  // ── Room mode UI ──
  if (isRoomMode) {
    const disabled = isProcessing || isStreaming;

    return (
      <div className="bg-[var(--bg-primary)] border-t border-[var(--border)] sticky bottom-0 z-10 px-5 py-4 md:px-8 md:py-5">
        <div className="max-w-4xl mx-auto flex flex-col gap-2">
          {/* Input / status area */}
          {isProcessing || isStreaming ? (
            <div className="flex items-center justify-center gap-2 py-3 text-indigo-400 text-sm animate-pulse">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              <span className="ml-2">DM 正在叙述...</span>
            </div>
          ) : hasSubmitted ? (
            <div className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
              <span className="text-sm text-green-400">✓ 已提交行动，等待其他玩家...</span>
              <button
                onClick={handleRetract}
                className="text-xs text-[var(--text-secondary)] hover:text-red-400 transition-colors"
              >
                撤回
              </button>
            </div>
          ) : (
            <div className="relative flex items-end gap-2 bg-[var(--bg-surface)] ring-1 ring-inset ring-white/5 focus-within:ring-white/20 rounded-xl p-2 transition-all duration-200 shadow-sm">
              <textarea
                ref={textareaRef}
                value={stagedContent}
                onChange={(e) => {
                  setStagedContent(e.target.value);
                  handleInput();
                }}
                onKeyDown={handleKeyDown}
                placeholder="描述你的行动... (Shift+Enter 换行)"
                rows={1}
                disabled={disabled}
                className="flex-1 bg-transparent border-none outline-none resize-none px-3 py-2 text-[14.5px] text-[var(--text-primary)] placeholder-[var(--text-secondary)] placeholder:opacity-60 max-h-40 minimal-scrollbar leading-relaxed"
              />
              <button
                onClick={handleSubmit}
                disabled={!stagedContent.trim() || disabled}
                title="提交行动"
                className="h-9 px-3 flex shrink-0 items-center justify-center rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/5 disabled:text-[var(--text-secondary)] text-white text-xs font-medium transition-all self-end disabled:opacity-50 ring-1 ring-inset ring-white/10 mb-0.5 mr-0.5"
              >
                提交行动
              </button>
            </div>
          )}

          {/* Host-only force submit */}
          {isHost && !isProcessing && !isStreaming && (
            <div className="flex justify-end">
              <button
                onClick={forceSubmit}
                className="text-xs text-amber-500 hover:text-amber-400 transition-colors"
              >
                强制提交（跳过未提交玩家）
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Solo mode UI ──
  return (
    <div className="bg-[var(--bg-primary)] border-t border-[var(--border)] sticky bottom-0 z-10 px-5 py-4 md:px-8 md:py-5">
        <div className="max-w-4xl mx-auto relative flex items-end gap-2 bg-[var(--bg-surface)] ring-1 ring-inset ring-white/5 focus-within:ring-white/20 rounded-xl p-2 transition-all duration-200 shadow-sm">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            handleInput();
          }}
          onKeyDown={handleKeyDown}
          placeholder="输入您的创作想法... (Shift+Enter 换行)"
          rows={1}
          disabled={isStreaming}
          className="flex-1 bg-transparent border-none outline-none resize-none px-3 py-2 text-[14.5px] text-[var(--text-primary)] placeholder-[var(--text-secondary)] placeholder:opacity-60 max-h-40 minimal-scrollbar leading-relaxed"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || isStreaming}
          title="发送"
          className="h-9 w-9 flex shrink-0 items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-white/5 disabled:text-[var(--text-secondary)] text-white transition-all self-end disabled:opacity-50 disabled:ring-0 ring-1 ring-inset ring-white/10 mb-0.5 mr-0.5 shadow-sm"
        >
           <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </button>
      </div>
    </div>
  );
}

