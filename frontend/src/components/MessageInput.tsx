import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import { useChatStore } from "../stores/chatStore";

export default function MessageInput() {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const isStreaming = useChatStore((s) => s.isStreaming);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    sendMessage(trimmed);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "42px";
    }
  }, [text, isStreaming, sendMessage]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "42px";
      el.style.height = Math.min(el.scrollHeight, 160) + "px";
    }
  };

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
