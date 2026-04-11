import { useSessionStore } from "../stores/sessionStore";
import { useChatStore } from "../stores/chatStore";

interface Props {
  onNewSession: () => void;
  onManageStories: () => void;
  onManageProtagonists: () => void;
  onManageUserProtagonists: () => void;
  onManagePresets: () => void;
  onManageConnections: () => void;
  onShowHistory: () => void;
}

export default function SessionList({ onNewSession, onManageStories, onManageProtagonists, onManageUserProtagonists, onManagePresets, onManageConnections, onShowHistory }: Props) {
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
      <div className="flex-1 flex gap-1 overflow-x-auto overflow-y-hidden custom-scrollbar px-3 py-2 items-center">
        {openSessions.map((s) => (
          <div
            key={s.id}
            className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap text-[13.5px] transition-all ${
              s.id === currentSessionId 
                ? "bg-blue-600 text-white font-medium shadow-sm" 
                : "bg-transparent hover:bg-white/5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
            onClick={() => handleSelect(s.id)}
          >
            <span className="max-w-[120px] overflow-hidden text-ellipsis">{s.title}</span>
            <button 
              className="opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-red-400 text-[var(--text-secondary)] rounded px-0.5 text-xs transition-opacity" 
              onClick={(e) => handleClose(e, s.id)}
            >
              ✕
            </button>
          </div>
        ))}
        <button 
          className="ml-1 px-3 py-1.5 rounded-lg bg-white/5 text-[var(--text-secondary)] hover:text-white hover:bg-white/10 border border-white/5 text-[13.5px] whitespace-nowrap transition-colors flex items-center gap-1 shadow-sm" 
          onClick={onNewSession}
        >
          <span className="text-base leading-none">+</span> 新建
        </button>
      </div>
      
      <div className="flex flex-wrap md:flex-nowrap items-center gap-1 shrink-0 border-t md:border-t-0 md:border-l border-white/10 pt-2 md:pt-0 md:pl-3 ml-2 md:mr-2 w-full md:w-auto px-2 md:px-0">
        <button className="px-2.5 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:text-white rounded-lg hover:bg-white/5 transition-colors" onClick={onShowHistory}>
          📜 历史
        </button>
        <button className="px-2.5 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:text-white rounded-lg hover:bg-white/5 transition-colors" onClick={onManageStories}>
          📚 故事
        </button>
        <button className="px-2.5 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:text-white rounded-lg hover:bg-white/5 transition-colors" onClick={onManageProtagonists}>
          👥 角色
        </button>
        <button className="px-2.5 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:text-white rounded-lg hover:bg-white/5 transition-colors" onClick={onManageUserProtagonists}>
          🎭 主角
        </button>
        <button className="px-2.5 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:text-white rounded-lg hover:bg-white/5 transition-colors" onClick={onManagePresets}>
          📝 预设
        </button>
        <button className="px-2.5 py-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:text-white rounded-lg hover:bg-white/5 transition-colors" onClick={onManageConnections}>
          🔗 连接
        </button>
      </div>
    </>
  );
}
