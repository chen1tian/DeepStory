import { useSessionStore } from "../stores/sessionStore";
import { useChatStore } from "../stores/chatStore";

interface Props {
  onClose: () => void;
}

export default function HistoryPanel({ onClose }: Props) {
  const sessions = useSessionStore((s) => s.sessions);
  const openSessionIds = useSessionStore((s) => s.openSessionIds);
  const openTab = useSessionStore((s) => s.openTab);
  const selectSession = useSessionStore((s) => s.selectSession);
  const removeSession = useSessionStore((s) => s.removeSession);
  const connectToSession = useChatStore((s) => s.connectToSession);

  const handleReopen = (id: string) => {
    openTab(id);
    selectSession(id);
    connectToSession(id);
    onClose();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定永久删除这个会话？删除后无法恢复。")) return;
    await removeSession(id);
  };

  const openSet = new Set(openSessionIds);

  return (
    <div className="story-manager-overlay" onClick={onClose}>
      <div className="history-panel" onClick={(e) => e.stopPropagation()}>
        <div className="story-manager-header">
          <h2>📜 聊天历史</h2>
          <div style={{ flex: 1 }} />
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="history-list">
          {sessions.length === 0 && (
            <div className="empty-state" style={{ padding: "32px" }}>
              <p>还没有任何聊天记录</p>
            </div>
          )}
          {sessions.map((s) => (
            <div key={s.id} className="history-item" onClick={() => handleReopen(s.id)}>
              <div className="history-info">
                <span className="history-title">{s.title}</span>
                <span className="history-date">
                  {new Date(s.updated_at || s.created_at).toLocaleString("zh-CN")}
                </span>
              </div>
              <div className="history-actions">
                {openSet.has(s.id) ? (
                  <span className="history-badge">已打开</span>
                ) : (
                  <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); handleReopen(s.id); }}>
                    打开
                  </button>
                )}
                <button
                  className="btn btn-sm btn-danger"
                  onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
