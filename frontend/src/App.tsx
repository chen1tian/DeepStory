import { useEffect } from "react";
import { useSessionStore } from "./stores/sessionStore";
import { useUIStore } from "./stores/uiStore";
import SessionList from "./components/SessionList";
import ChatView from "./components/ChatView";
import EditMode from "./components/EditMode";
import StatePanel from "./components/StatePanel";
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
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const editMode = useUIStore((s) => s.editMode);
  const statePanelOpen = useUIStore((s) => s.statePanelOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const toggleEditMode = useUIStore((s) => s.toggleEditMode);
  const toggleStatePanel = useUIStore((s) => s.toggleStatePanel);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return (
    <div className="app-layout">
      <Toasts />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "" : "collapsed"}`}>
        <SessionList />
      </aside>

      {/* Main */}
      <div className="main-content">
        <div className="top-bar">
          <button onClick={toggleSidebar} title="切换侧边栏">
            ☰
          </button>
          <button className={editMode ? "" : "active"} onClick={() => editMode && toggleEditMode()}>
            💬 聊天
          </button>
          <button className={editMode ? "active" : ""} onClick={() => !editMode && toggleEditMode()}>
            🎨 编辑
          </button>
          <div className="spacer" />
          <button
            className={statePanelOpen ? "active" : ""}
            onClick={toggleStatePanel}
          >
            📊 状态
          </button>
        </div>

        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            {editMode ? <EditMode /> : <ChatView />}
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
