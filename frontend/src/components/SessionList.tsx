import { useSessionStore } from "../stores/sessionStore";
import { useChatStore } from "../stores/chatStore";

interface Props {
  onNewSession: () => void;
  onManageStories: () => void;
  onManageProtagonists: () => void;
  onManagePresets: () => void;
}

export default function SessionList({ onNewSession, onManageStories, onManageProtagonists, onManagePresets }: Props) {
  const sessions = useSessionStore((s) => s.sessions);
  const currentSessionId = useSessionStore((s) => s.currentSessionId);
  const selectSession = useSessionStore((s) => s.selectSession);
  const removeSession = useSessionStore((s) => s.removeSession);
  const connectToSession = useChatStore((s) => s.connectToSession);

  const handleSelect = (id: string) => {
    selectSession(id);
    connectToSession(id);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await removeSession(id);
  };

  return (
    <>
      <div className="sidebar-header">
        <h2>对话列表</h2>
        <button className="btn" onClick={onNewSession} style={{ padding: "4px 12px" }}>
          + 新建
        </button>
      </div>
      <div className="session-list">
        {sessions.length === 0 && (
          <div style={{ padding: 16, textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>
            暂无对话，点击上方按钮新建
          </div>
        )}
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`session-item ${s.id === currentSessionId ? "active" : ""}`}
            onClick={() => handleSelect(s.id)}
          >
            <span className="title">{s.title}</span>
            <button className="delete-btn" onClick={(e) => handleDelete(e, s.id)}>
              ✕
            </button>
          </div>
        ))}
      </div>
      <div className="sidebar-footer">
        <button className="btn-ghost btn sidebar-stories-btn" onClick={onManageStories}>
          📚 故事管理
        </button>
        <button className="btn-ghost btn sidebar-stories-btn" onClick={onManageProtagonists}>
          🎭 主角管理
        </button>
        <button className="btn-ghost btn sidebar-stories-btn" onClick={onManagePresets}>
          📝 预设管理
        </button>
      </div>
    </>
  );
}
