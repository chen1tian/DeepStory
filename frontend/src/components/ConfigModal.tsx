import { useState } from "react";
import { useUIStore } from "../stores/uiStore";

export default function ConfigModal() {
  const maxMessageCount = useUIStore((s) => s.maxMessageCount);
  const setMaxMessageCount = useUIStore((s) => s.setMaxMessageCount);
  const contextLength = useUIStore((s) => s.contextLength);
  const setContextLength = useUIStore((s) => s.setContextLength);
  const setConfigOpen = useUIStore((s) => s.setConfigOpen);

  const [inputValue, setInputValue] = useState(String(maxMessageCount || ""));
  const [contextInputValue, setContextInputValue] = useState(String(contextLength));

  const handleSave = () => {
    const n = parseInt(inputValue, 10);
    if (inputValue.trim() === "" || (n >= 0 && !isNaN(n))) {
      setMaxMessageCount(n >= 0 && !isNaN(n) ? n : 0);
    }
    const ctx = parseInt(contextInputValue, 10);
    if (contextInputValue.trim() !== "" && !isNaN(ctx) && ctx >= 2048) {
      setContextLength(ctx);
    }
    setConfigOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") setConfigOpen(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center animate-[fadeIn_0.15s_ease-out]"
      onClick={() => setConfigOpen(false)}
    >
      <div
        className="w-[90vw] max-w-[420px] bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 border-b border-[var(--border)] flex items-center gap-3 bg-[var(--bg-secondary)]">
          <h2 className="text-base font-semibold">⚙️ 配置</h2>
          <div className="flex-1" />
          <button
            className="bg-transparent border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] px-4 py-2 rounded-lg text-[13px] cursor-pointer transition-colors"
            onClick={() => setConfigOpen(false)}
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-[var(--text-primary)]">
              对话记录数量
            </label>
            <p className="text-xs text-[var(--text-secondary)]">
              控制前端对话界面上显示的对话数量，超过该数量的历史消息将不显示。设为 0 表示显示全部。
            </p>
            <input
              type="number"
              min={0}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="0 = 显示全部"
              className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm font-[inherit] outline-none focus:border-indigo-500/60 transition-colors"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-[var(--text-primary)]">
              上下文长度
            </label>
            <p className="text-xs text-[var(--text-secondary)]">
              控制 AI 处理上下文窗口大小（tokens）。较大值可记住更多历史，但会增加 token 消耗。默认 8192。
            </p>
            <input
              type="number"
              min={2048}
              max={128000}
              step={1024}
              value={contextInputValue}
              onChange={(e) => setContextInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="8192"
              className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm font-[inherit] outline-none focus:border-indigo-500/60 transition-colors"
            />
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-[var(--border)] flex justify-end gap-2 bg-[var(--bg-secondary)]">
          <button
            className="bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] px-4 py-2 rounded-lg text-[13px] cursor-pointer transition-colors"
            onClick={() => setConfigOpen(false)}
          >
            取消
          </button>
          <button
            className="bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2 rounded-lg text-[13px] cursor-pointer border-none transition-colors"
            onClick={handleSave}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
