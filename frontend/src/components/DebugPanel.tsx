import { useState } from "react";
import { getDebugPrompt, type DebugPromptResponse, type DebugMessage } from "../services/api";

interface Props {
  sessionId: string;
  onClose: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  system: "🔧 System",
  user: "👤 User",
  assistant: "🤖 Assistant",
};

const ROLE_COLORS: Record<string, string> = {
  system: "#f59e0b",
  user: "#3b82f6",
  assistant: "#10b981",
};

export default function DebugPanel({ sessionId, onClose }: Props) {
  const [data, setData] = useState<DebugPromptResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userInput, setUserInput] = useState("你好，这是一条测试消息");
  const [expandedIdx, setExpandedIdx] = useState<Set<number>>(new Set());

  const handleLoad = async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await getDebugPrompt(sessionId, userInput);
      setData(resp);
      // Expand all by default
      setExpandedIdx(new Set(resp.messages.map((_, i) => i)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (idx: number) => {
    setExpandedIdx((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const expandAll = () => {
    if (data) setExpandedIdx(new Set(data.messages.map((_, i) => i)));
  };
  const collapseAll = () => setExpandedIdx(new Set());

  const copyAll = () => {
    if (!data) return;
    const text = data.messages
      .map((m) => `[${m.role.toUpperCase()}]\n${m.content}`)
      .join("\n\n---\n\n");
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center animate-[fadeIn_0.15s_ease-out]" onClick={onClose}>
      <div className="w-[90vw] max-w-[900px] h-[85vh] bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3.5 border-b border-[var(--border)] flex items-center gap-3 bg-[var(--bg-secondary)]">
          <h2 className="text-base font-semibold">🔍 调试 - 发送内容预览</h2>
          <div className="flex-1" />
          <button className="bg-transparent border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] px-4 py-2 rounded-lg text-[13px] cursor-pointer transition-colors" onClick={onClose}>✕</button>
        </div>

        <div className="px-5 py-3.5 border-b border-[var(--border)] flex flex-col gap-1.5">
          <label className="text-xs text-[var(--text-secondary)] font-medium">模拟用户输入</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="输入测试消息…"
              style={{ flex: 1 }}
              className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm font-[inherit] outline-none focus:border-indigo-500/60 transition-colors"
            />
            <button className="bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2 rounded-lg text-[13px] cursor-pointer border-none transition-colors disabled:opacity-50" onClick={handleLoad} disabled={loading}>
              {loading ? "加载中…" : "🔄 预览 Prompt"}
            </button>
          </div>
        </div>

        {error && <div className="px-5 py-2.5 text-red-500 text-[13px]">{error}</div>}

        {data && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Budget summary */}
            <div className="px-5 py-2.5 bg-[var(--bg-secondary)] border-b border-[var(--border)] flex items-center gap-3 flex-wrap">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">Token 预算</span>
              <div className="flex gap-2.5 flex-wrap">
                {Object.entries(data.budget).map(([k, v]) => (
                  <span key={k} className="text-[11px] text-[var(--text-secondary)] bg-[var(--bg-surface)] px-2 py-0.5 rounded">
                    {k}: <strong className="text-[var(--text-primary)]">{v}</strong>
                  </span>
                ))}
              </div>
              <span className="text-xs font-semibold text-indigo-400 ml-auto">
                共 {data.total_messages} 条消息
              </span>
            </div>

            {/* Toolbar */}
            <div className="px-5 py-2 flex gap-2 border-b border-[var(--border)]">
              <button className="bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] px-2.5 py-1 rounded-md cursor-pointer text-xs hover:bg-[var(--bg-tertiary)] transition-colors" onClick={expandAll}>全部展开</button>
              <button className="bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] px-2.5 py-1 rounded-md cursor-pointer text-xs hover:bg-[var(--bg-tertiary)] transition-colors" onClick={collapseAll}>全部折叠</button>
              <button className="bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] px-2.5 py-1 rounded-md cursor-pointer text-xs hover:bg-[var(--bg-tertiary)] transition-colors" onClick={copyAll}>📋 复制全部</button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-3 minimal-scrollbar">
              {data.messages.map((m, i) => (
                <DebugMessageItem
                  key={i}
                  index={i}
                  msg={m}
                  expanded={expandedIdx.has(i)}
                  onToggle={() => toggleExpand(i)}
                />
              ))}
            </div>
          </div>
        )}

        {!data && !loading && !error && (
          <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)] gap-3" style={{ padding: 40 }}>
            <div className="text-5xl opacity-30">🔍</div>
            <div>点击"预览 Prompt"查看将发送给 AI 的完整内容</div>
          </div>
        )}
      </div>
    </div>
  );
}

function DebugMessageItem({
  index,
  msg,
  expanded,
  onToggle,
}: {
  index: number;
  msg: DebugMessage;
  expanded: boolean;
  onToggle: () => void;
}) {
  const roleLabel = ROLE_LABELS[msg.role] || msg.role;
  const roleColor = ROLE_COLORS[msg.role] || "var(--text-secondary)";
  const preview = msg.content.length > 80 ? msg.content.slice(0, 80) + "…" : msg.content;

  return (
    <div className="border border-[var(--border)] rounded-lg mb-2 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors" onClick={onToggle}>
        <span className="text-[11px] text-[var(--text-secondary)] font-semibold min-w-[24px]">#{index + 1}</span>
        <span className="text-xs font-semibold min-w-[90px]" style={{ color: roleColor }}>{roleLabel}</span>
        {!expanded && <span className="text-xs text-[var(--text-secondary)] overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0">{preview}</span>}
        <span className="flex-1" />
        <span className="text-[11px] text-[var(--text-secondary)] whitespace-nowrap">{msg.content.length} 字</span>
        <span className="text-[10px] text-[var(--text-secondary)]">{expanded ? "▼" : "▶"}</span>
      </div>
      {expanded && (
        <pre className="px-3 py-3 text-[13px] leading-relaxed whitespace-pre-wrap break-words bg-[var(--bg-surface)] border-t border-[var(--border)] m-0 max-h-[300px] overflow-y-auto font-[inherit] text-[var(--text-primary)]">{msg.content}</pre>
      )}
    </div>
  );
}
