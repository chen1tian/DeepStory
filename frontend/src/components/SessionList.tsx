import { useSessionStore } from "../stores/sessionStore";
import { useChatStore } from "../stores/chatStore";

interface Props {
  onNewSession: () => void;
  onManageStories: () => void;
  onManageProtagonists: () => void;
  onManagePresets: () => void;
  onShowHistory: () => void;
}

export default function SessionList({ onNewSession, onManageStories, onManageProtagonists, onManagePresets, onShowHistory }: Props) {
  const sessions = useSessionStore((s) => s.sessions);
  const openSessionIds = useSessionStore((s) => s.openSessionIds);
  const currentSessionId = useSessionStore((s) => s.currentSessionId);
  const selectSession = useSessionStore((s) => s.selectSession);
  const closeTab = useSessionStore((s) => s.closeTab);
  const connectToSession = useChatStore((s) => s.connectToSession);

  const openSessions = openSessionIds
    .map((id) => sessions.find((s) => s.id === id))
    .filter(Boolean) as typeof sessions;

  const handleSelect = (id: string) => {
    selectSession(id);
    connectToSession(id);
  };

  const handleClose = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    closeTab(id);
  };

  return (
    <>
      <div className="nav-sessions">
        {openSessions.map((s) => (
          <div
            key={s.id}
            className={`nav-session-item ${s.id === currentSessionId ? "active" : ""}`}
            onClick={() => handleSelect(s.id)}
          >
            <span className="title">{s.title}</span>
            <button className="delete-btn" onClick={(e) => handleClose(e, s.id)}>
              ✕
            </button>
          </div>
        ))}
        <button className="btn nav-new-btn" onClick={onNewSession}>
          + 新建
        </button>
      </div>
      <div className="nav-actions">
        <button className="btn-ghost btn nav-action-btn" onClick={onShowHistory}>
          📜 历史
        </button>
        <button className="btn-ghost btn nav-action-btn" onClick={onManageStories}>
          📚 故事
        </button>
        <button className="btn-ghost btn nav-action-btn" onClick={onManageProtagonists}>
          🎭 主角
        </button>
        <button className="btn-ghost btn nav-action-btn" onClick={onManagePresets}>
          📝 预设
        </button>
      </div>
    </>
  );
}
