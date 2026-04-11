import { useEffect, useState } from "react";
import { useSessionStore } from "./stores/sessionStore";
import { useUIStore } from "./stores/uiStore";
import { useChatStore } from "./stores/chatStore";
import { usePresetStore } from "./stores/presetStore";
import SessionList from "./components/SessionList";
import ChatView from "./components/ChatView";
import EditMode from "./components/EditMode";
import StatePanel from "./components/StatePanel";
import StoryManager from "./components/StoryManager";
import StorySelector from "./components/StorySelector";
import ProtagonistManager from "./components/ProtagonistManager";
import UserProtagonistManager from "./components/UserProtagonistManager";
import PresetManager from "./components/PresetManager";
import PresetSwitcher from "./components/PresetSwitcher";
import ConnectionManager from "./components/ConnectionManager";
import ConnectionSwitcher from "./components/ConnectionSwitcher";
import DebugPanel from "./components/DebugPanel";
import HistoryPanel from "./components/HistoryPanel";
import HookManager from "./components/HookManager";
import "./styles/global.css";

function Toasts() {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);
  if (toasts.length === 0) return null;
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`} onClick={() => removeToast(t.id)}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const addSession = useSessionStore((s) => s.addSession);
  const connectToSession = useChatStore((s) => s.connectToSession);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const editMode = useUIStore((s) => s.editMode);
  const statePanelOpen = useUIStore((s) => s.statePanelOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const toggleEditMode = useUIStore((s) => s.toggleEditMode);
  const toggleStatePanel = useUIStore((s) => s.toggleStatePanel);

  const currentSessionId = useSessionStore((s) => s.currentSessionId);

  const [showStoryManager, setShowStoryManager] = useState(false);
  const [showStorySelector, setShowStorySelector] = useState(false);
  const [showProtagonistManager, setShowProtagonistManager] = useState(false);
  const [showUserProtagonistManager, setShowUserProtagonistManager] = useState(false);
  const [showPresetManager, setShowPresetManager] = useState(false);
  const [showConnectionManager, setShowConnectionManager] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [showHookManager, setShowHookManager] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const sessions = useSessionStore((s) => s.sessions);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Auto-connect to restored session after sessions are loaded
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    if (!restored && sessions.length > 0 && currentSessionId) {
      connectToSession(currentSessionId);
      setRestored(true);
    }
  }, [sessions, currentSessionId, restored, connectToSession]);

  const handleNewSession = () => setShowStorySelector(true);

  const handleStorySelect = async (storyId: string, openerIndex: number) => {
    setShowStorySelector(false);
    const session = await addSession(undefined, storyId, openerIndex);
    connectToSession(session.id);
  };

  const handleSkipStory = async (presetId?: string) => {
    setShowStorySelector(false);
    let systemPrompt: string | undefined;
    if (presetId) {
      const preset = usePresetStore.getState().presets.find((p) => p.id === presetId);
      systemPrompt = preset?.content;
    }
    const session = await addSession(undefined, undefined, undefined, undefined, systemPrompt);
    connectToSession(session.id);
  };

  return (
    <div className="app-layout h-[100dvh] flex flex-col w-full text-[var(--text-primary)]">
      <Toasts />

      {showStoryManager && (
        <StoryManager onClose={() => setShowStoryManager(false)} />
      )}
      {showProtagonistManager && (
        <ProtagonistManager onClose={() => setShowProtagonistManager(false)} />
      )}
      {showUserProtagonistManager && (
        <UserProtagonistManager onClose={() => setShowUserProtagonistManager(false)} />
      )}
      {showPresetManager && (
        <PresetManager onClose={() => setShowPresetManager(false)} />
      )}
      {showConnectionManager && (
        <ConnectionManager onClose={() => setShowConnectionManager(false)} />
      )}
      {showDebugPanel && currentSessionId && (
        <DebugPanel
          sessionId={currentSessionId}
          onClose={() => setShowDebugPanel(false)}
        />
      )}
      {showHistoryPanel && (
        <HistoryPanel onClose={() => setShowHistoryPanel(false)} />
      )}
      {showHookManager && (
        <HookManager onClose={() => setShowHookManager(false)} />
      )}
      {showStorySelector && (
        <StorySelector
          onSelect={handleStorySelect}
          onSkip={handleSkipStory}
          onCancel={() => setShowStorySelector(false)}
        />
      )}

      {/* 移动端顶部标题栏 */}
      <div className="md:hidden flex items-center bg-[var(--bg-secondary)] border-b border-[var(--border)] h-12 px-3 justify-between shrink-0">
        <div className="flex items-center gap-2">
          <button 
            className="p-1 px-2 text-[var(--accent)] rounded hover:bg-[var(--bg-tertiary)]"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            ☰ 菜单 
          </button>
          <span className="font-bold text-sm truncate max-w-[150px]">
            {sessions.find(s => s.id === currentSessionId)?.title || 'Creative Chat'}
          </span>
        </div>
        <div className="flex gap-1 text-sm">
          <button
            className={`px-2 py-1 rounded ${!editMode ? "bg-[var(--accent)] text-white" : "text-[var(--text-secondary)]"}`}
            onClick={() => { if (editMode) toggleEditMode(); }}
          >
            💬
          </button>
          <button
            className={`px-2 py-1 rounded ${editMode ? "bg-[var(--accent)] text-white" : "text-[var(--text-secondary)]"}`}
            onClick={() => { if (!editMode) toggleEditMode(); }}
          >
            🎨
          </button>
          <button
            className={`px-2 py-1 rounded text-lg ${statePanelOpen ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"}`}
            onClick={toggleStatePanel}
          >
            📊
          </button>
        </div>
      </div>

      {/* 侧边栏/抽屉（包含所有导航项） */}
      <nav className={`top-nav flex-col md:flex-row md:flex transition-transform w-full ${mobileMenuOpen ? 'flex h-auto max-h-[50vh] overflow-y-auto w-full z-10 sticky top-0 shadow-lg border-b border-[var(--border)]' : 'hidden md:flex'}`}>
        <SessionList
          onNewSession={() => { handleNewSession(); setMobileMenuOpen(false); }}
          onShowHistory={() => { setShowHistoryPanel(true); setMobileMenuOpen(false); }}
          onManageStories={() => { setShowStoryManager(true); setMobileMenuOpen(false); }}
          onManageProtagonists={() => { setShowProtagonistManager(true); setMobileMenuOpen(false); }}
          onManageUserProtagonists={() => { setShowUserProtagonistManager(true); setMobileMenuOpen(false); }}
          onManagePresets={() => { setShowPresetManager(true); setMobileMenuOpen(false); }}            onManageConnections={() => { setShowConnectionManager(true); setMobileMenuOpen(false); }}        />
      </nav>

      {/* Main */}
      <div className="main-content flex-1 flex flex-col min-h-0 bg-[var(--bg-primary)]">
        {/* PC端顶部工具栏 */}
        <div className="hidden md:flex items-center h-12 border-b border-[var(--border)] px-4 gap-3 bg-[var(--bg-secondary)] shadow-sm shrink-0 relative z-10">
          <button
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${!editMode ? "bg-indigo-600 text-white shadow-md text-shadow-sm" : "bg-transparent text-gray-400 hover:text-gray-200 hover:bg-[var(--bg-tertiary)]"}`}
            onClick={() => { if (editMode) toggleEditMode(); }}
          >
            💬 聊天
          </button>
          <button
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${editMode ? "bg-indigo-600 text-white shadow-md text-shadow-sm" : "bg-transparent text-gray-400 hover:text-gray-200 hover:bg-[var(--bg-tertiary)]"}`}
            onClick={() => { if (!editMode) toggleEditMode(); }}
          >
            🎨 编辑
          </button>
          <div className="flex-1" />
          {currentSessionId && <PresetSwitcher sessionId={currentSessionId} />}
          <div className="h-4 w-px bg-gray-700 mx-1" />
          <ConnectionSwitcher />
          <div className="h-4 w-px bg-gray-700 mx-1" />
          <button
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${statePanelOpen ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "bg-transparent text-gray-400 hover:text-gray-200 hover:bg-[var(--bg-tertiary)]"}`}
            onClick={toggleStatePanel}
          >
            <span className="text-base">📊</span> 状态
          </button>
          <button
            onClick={() => setShowDebugPanel(true)}
            disabled={!currentSessionId}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-transparent text-gray-400 hover:text-gray-200 hover:bg-[var(--bg-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1"
            title="调试 - 查看发送内容"
          >
            <span className="text-base">🔍</span> 调试
          </button>
          <button
            onClick={() => setShowHookManager(true)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-transparent text-gray-400 hover:text-gray-200 hover:bg-[var(--bg-tertiary)] transition-all flex items-center gap-1"
            title="Chat Hook 管理"
          >
            <span className="text-base">🔗</span> Hooks
          </button>
        </div>

        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            {editMode ? (
              <EditMode />
            ) : (
              <ChatView />
            )}
          </div>

          {statePanelOpen && (
            <aside className="state-panel fixed md:static inset-0 z-50 md:z-auto bg-[var(--bg-primary)] md:w-80 w-full flex flex-col">
              {/* 移动端 state面板返回按钮 */}
              <div className="md:hidden flex items-center bg-[var(--bg-secondary)] border-b border-[var(--border)] h-12 px-3 justify-between shrink-0 sticky top-0 z-10 w-full">
                 <span className="font-bold">📊 状态板</span>
                 <button onClick={toggleStatePanel} className="text-[var(--text-secondary)] text-2xl p-2 w-10 h-10 flex items-center justify-center rounded-full hover:bg-[var(--bg-tertiary)] active:bg-gray-700">×</button>
              </div>
              <div className="flex-1 overflow-y-auto w-full p-4">
                <StatePanel />
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
