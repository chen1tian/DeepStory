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
      <div className="nav-sessions flex-1 flex gap-2 overflow-x-auto overflow-y-hidden custom-scrollbar px-2 py-1 items-center">
        {openSessions.map((s) => (
          <div
            key={s.id}
            className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap text-[13px] transition-all border ${
              s.id === currentSessionId 
                ? "bg-[var(--bg-tertiary)] border-indigo-500/50 shadow-sm text-indigo-50" 
                : "bg-transparent border-transparent hover:bg-[var(--bg-tertiary)] hover:border-[var(--border)] text-gray-300 hover:text-gray-100"
            }`}
            onClick={() => handleSelect(s.id)}
          >
            <span className="max-w-[120px] overflow-hidden text-ellipsis">{s.title}</span>
            <button 
              className="opacity-0 group-hover:opacity-100 hover:text-red-400 text-gray-500 rounded-full px-1 text-xs transition-opacity" 
              onClick={(e) => handleClose(e, s.id)}
            >
              ✕
            </button>
          </div>
        ))}
        <button 
          className="ml-1 px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-500/30 text-sm whitespace-nowrap transition-colors flex items-center shadow-sm" 
          onClick={onNewSession}
        >
          <span className="mr-1 text-lg leading-none">+</span> 新建
        </button>
      </div>
      
      <div className="flex flex-wrap md:flex-nowrap items-center gap-1.5 shrink-0 border-t md:border-t-0 md:border-l border-[var(--border)] pt-2 md:pt-0 md:pl-3 ml-2 md:mr-2 w-full md:w-auto px-2 md:px-0">
        <button className="px-3 py-1.5 text-xs text-gray-300 hover:text-white rounded-md hover:bg-[var(--bg-tertiary)] transition-colors" onClick={onShowHistory}>
          📜 历史
        </button>
        <button className="px-3 py-1.5 text-xs text-gray-300 hover:text-white rounded-md hover:bg-[var(--bg-tertiary)] transition-colors" onClick={onManageStories}>
          📚 故事
        </button>
        <button className="px-3 py-1.5 text-xs text-gray-300 hover:text-white rounded-md hover:bg-[var(--bg-tertiary)] transition-colors" onClick={onManageProtagonists}>
          👥 角色
        </button>
        <button className="px-3 py-1.5 text-xs text-gray-300 hover:text-white rounded-md hover:bg-[var(--bg-tertiary)] transition-colors" onClick={onManageUserProtagonists}>
          🎭 主角
        </button>
        <button className="px-3 py-1.5 text-xs text-gray-300 hover:text-white rounded-md hover:bg-[var(--bg-tertiary)] transition-colors" onClick={onManagePresets}>
          📝 预设
        </button>
        <button className="px-3 py-1.5 text-xs text-gray-300 hover:text-white rounded-md hover:bg-[var(--bg-tertiary)] transition-colors" onClick={onManageConnections}>
          🔗 连接
        </button>
      </div>
    </>
  );
}
