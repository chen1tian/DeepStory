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
import PresetManager from "./components/PresetManager";
import PresetSwitcher from "./components/PresetSwitcher";
import DebugPanel from "./components/DebugPanel";
import HistoryPanel from "./components/HistoryPanel";
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
  const [showPresetManager, setShowPresetManager] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);

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
    <div className="app-layout">
      <Toasts />

      {showStoryManager && (
        <StoryManager onClose={() => setShowStoryManager(false)} />
      )}
      {showProtagonistManager && (
        <ProtagonistManager onClose={() => setShowProtagonistManager(false)} />
      )}
      {showPresetManager && (
        <PresetManager onClose={() => setShowPresetManager(false)} />
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
      {showStorySelector && (
        <StorySelector
          onSelect={handleStorySelect}
          onSkip={handleSkipStory}
          onCancel={() => setShowStorySelector(false)}
        />
      )}

      {/* Top Navigation Bar */}
      <nav className="top-nav">
        <SessionList
          onNewSession={handleNewSession}
          onShowHistory={() => setShowHistoryPanel(true)}
          onManageStories={() => setShowStoryManager(true)}
          onManageProtagonists={() => setShowProtagonistManager(true)}
          onManagePresets={() => setShowPresetManager(true)}
        />
      </nav>

      {/* Main */}
      <div className="main-content">
        <div className="top-bar">
          <button
            className={!editMode ? "active" : ""}
            onClick={() => { if (editMode) toggleEditMode(); }}
          >
            💬 聊天
          </button>
          <button
            className={editMode ? "active" : ""}
            onClick={() => { if (!editMode) toggleEditMode(); }}
          >
            🎨 编辑
          </button>
          <div className="spacer" />
          {currentSessionId && <PresetSwitcher sessionId={currentSessionId} />}
          <button
            className={statePanelOpen ? "active" : ""}
            onClick={toggleStatePanel}
          >
            📊 状态
          </button>
          <button
            onClick={() => setShowDebugPanel(true)}
            disabled={!currentSessionId}
            title="调试 - 查看发送内容"
          >
            🔍 调试
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
            <aside className="state-panel">
              <StatePanel />
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
