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
    <div className="story-manager-overlay" onClick={onClose}>
      <div className="debug-panel" onClick={(e) => e.stopPropagation()}>
        <div className="debug-panel-header">
          <h2>🔍 调试 - 发送内容预览</h2>
          <div className="spacer" />
          <button className="btn-ghost btn" onClick={onClose}>✕</button>
        </div>

        <div className="debug-input-section">
          <label>模拟用户输入</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="输入测试消息…"
              style={{ flex: 1 }}
            />
            <button className="btn" onClick={handleLoad} disabled={loading}>
              {loading ? "加载中…" : "🔄 预览 Prompt"}
            </button>
          </div>
        </div>

        {error && <div className="debug-error">{error}</div>}

        {data && (
          <div className="debug-content">
            {/* Budget summary */}
            <div className="debug-budget">
              <span className="debug-budget-title">Token 预算</span>
              <div className="debug-budget-items">
                {Object.entries(data.budget).map(([k, v]) => (
                  <span key={k} className="debug-budget-item">
                    {k}: <strong>{v}</strong>
                  </span>
                ))}
              </div>
              <span className="debug-budget-total">
                共 {data.total_messages} 条消息
              </span>
            </div>

            {/* Toolbar */}
            <div className="debug-toolbar">
              <button className="btn-small" onClick={expandAll}>全部展开</button>
              <button className="btn-small" onClick={collapseAll}>全部折叠</button>
              <button className="btn-small" onClick={copyAll}>📋 复制全部</button>
            </div>

            {/* Messages */}
            <div className="debug-messages">
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
          <div className="empty-state" style={{ padding: 40 }}>
            <div className="icon">🔍</div>
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
    <div className="debug-msg-item">
      <div className="debug-msg-header" onClick={onToggle}>
        <span className="debug-msg-index">#{index + 1}</span>
        <span className="debug-msg-role" style={{ color: roleColor }}>{roleLabel}</span>
        {!expanded && <span className="debug-msg-preview">{preview}</span>}
        <span className="spacer" />
        <span className="debug-msg-chars">{msg.content.length} 字</span>
        <span className="debug-msg-toggle">{expanded ? "▼" : "▶"}</span>
      </div>
      {expanded && (
        <pre className="debug-msg-content">{msg.content}</pre>
      )}
    </div>
  );
}
