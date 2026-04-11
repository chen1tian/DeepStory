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
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center animate-[fadeIn_0.15s_ease-out]" onClick={onClose}>
      <div className="w-[90vw] max-w-[640px] h-[75vh] bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-3 bg-[var(--bg-secondary)]">
          <h2 className="text-base font-semibold">📜 聊天历史</h2>
          <div className="flex-1" />
          <button className="bg-transparent border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] px-3 py-1.5 rounded-lg text-[13px] cursor-pointer transition-colors" onClick={onClose}>✕</button>
        </div>
        <div className="flex-1 overflow-y-auto minimal-scrollbar">
          {sessions.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)] gap-3 p-8">
              <p>还没有任何聊天记录</p>
            </div>
          )}
          {sessions.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] cursor-pointer hover:bg-[var(--bg-surface)] transition-colors"
              onClick={() => handleReopen(s.id)}
            >
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-[13px] font-medium text-[var(--text-primary)] truncate">{s.title}</span>
                <span className="text-[11px] text-[var(--text-secondary)]">
                  {new Date(s.updated_at || s.created_at).toLocaleString("zh-CN")}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {openSet.has(s.id) ? (
                  <span className="text-[11px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">已打开</span>
                ) : (
                  <button
                    className="bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] px-2.5 py-1 rounded-md cursor-pointer text-xs hover:bg-[var(--bg-tertiary)] transition-colors"
                    onClick={(e) => { e.stopPropagation(); handleReopen(s.id); }}
                  >
                    打开
                  </button>
                )}
                <button
                  className="bg-transparent border border-red-500/30 text-red-400 px-2.5 py-1 rounded-md cursor-pointer text-xs hover:bg-red-500/10 transition-colors"
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
