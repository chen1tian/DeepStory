import { useSessionStore } from "../stores/sessionStore";
import { useChatStore } from "../stores/chatStore";

export default function SessionList() {
  const sessions = useSessionStore((s) => s.sessions);
  const currentSessionId = useSessionStore((s) => s.currentSessionId);
  const selectSession = useSessionStore((s) => s.selectSession);
  const addSession = useSessionStore((s) => s.addSession);
  const removeSession = useSessionStore((s) => s.removeSession);
  const connectToSession = useChatStore((s) => s.connectToSession);

  const handleSelect = (id: string) => {
    selectSession(id);
    connectToSession(id);
  };

  const handleNew = async () => {
    const session = await addSession();
    connectToSession(session.id);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await removeSession(id);
  };

  return (
    <>
      <div className="sidebar-header">
        <h2>对话列表</h2>
        <button className="btn" onClick={handleNew} style={{ padding: "4px 12px" }}>
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
    </>
  );
}
