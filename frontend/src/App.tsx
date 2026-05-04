import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useSessionStore } from "./stores/sessionStore";
import { useUIStore } from "./stores/uiStore";
import { useChatStore } from "./stores/chatStore";
import { usePresetStore } from "./stores/presetStore";
import { useNarratorStore } from "./stores/narratorStore";
import { useAuthStore } from "./stores/authStore";
import { useRoomStore } from "./stores/roomStore";
import LoginPage from "./components/LoginPage";
import RegisterPage from "./components/RegisterPage";
import SessionList from "./components/SessionList";
import ChatView from "./components/ChatView";
import EditMode from "./components/EditMode";
import StatePanel from "./components/StatePanel";
import NarratorPanel from "./components/NarratorPanel";
import ArcEditor from "./components/ArcEditor";
import StoryManager from "./components/StoryManager";
import StorySelector from "./components/StorySelector";
import ProtagonistManager from "./components/ProtagonistManager";
import UserProtagonistManager from "./components/UserProtagonistManager";
import PresetManager from "./components/PresetManager";
import PresetSwitcher from "./components/PresetSwitcher";
import ConnectionManager from "./components/ConnectionManager";
import ConnectionSwitcher from "./components/ConnectionSwitcher";
import GameSettingManager from "./components/GameSettingManager";
import DebugPanel from "./components/DebugPanel";
import HistoryPanel from "./components/HistoryPanel";
import HookManager from "./components/HookManager";
import MapOverlay from "./components/MapDisplay";
import ConfigModal from "./components/ConfigModal";
import CreateRoomModal from "./components/CreateRoomModal";
import JoinRoomModal from "./components/JoinRoomModal";
import "./styles/global.css";

type ImmersivePanel = "sessions" | "tools" | "state" | "narrator" | null;

function shouldStartInImmersiveMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const touchLikeScreen = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  const narrowViewport = window.innerWidth <= 900;
  return touchLikeScreen || narrowViewport;
}

function Toasts() {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-4 right-4 z-[1000] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-2.5 rounded-lg text-[13px] max-w-[360px] cursor-pointer animate-[slideIn_0.2s_ease-out] ${
            t.type === "error" ? "bg-red-500 text-white" :
            t.type === "success" ? "bg-green-500 text-white" :
            "bg-blue-500 text-white"
          }`}
          onClick={() => removeToast(t.id)}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

function FloatingIconButton({
  icon,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`h-11 w-11 rounded-2xl border text-lg shadow-lg backdrop-blur-md transition-all ${
        active
          ? "border-blue-400/60 bg-blue-500/25 text-white"
          : "border-white/10 bg-slate-950/70 text-[var(--text-secondary)] hover:bg-slate-900/90 hover:text-white"
      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      {icon}
    </button>
  );
}

export default function App() {
  const restoreFromStorage = useAuthStore((s) => s.restoreFromStorage);
  useEffect(() => {
    restoreFromStorage();
  }, [restoreFromStorage]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/*" element={<ProtectedRoute />} />
      </Routes>
    </BrowserRouter>
  );
}

function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const initialized = useAuthStore((s) => s.initialized);
  if (!initialized) {
    return null;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <MainApp />;
}

function MainApp() {
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const addSession = useSessionStore((s) => s.addSession);
  const connectToSession = useChatStore((s) => s.connectToSession);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const editMode = useUIStore((s) => s.editMode);
  const statePanelOpen = useUIStore((s) => s.statePanelOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const toggleEditMode = useUIStore((s) => s.toggleEditMode);
  const toggleStatePanel = useUIStore((s) => s.toggleStatePanel);
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  const currentSessionId = useSessionStore((s) => s.currentSessionId);

  const configOpen = useUIStore((s) => s.configOpen);
  const setConfigOpen = useUIStore((s) => s.setConfigOpen);

  const [showStoryManager, setShowStoryManager] = useState(false);
  const [showStorySelector, setShowStorySelector] = useState(false);
  const [showProtagonistManager, setShowProtagonistManager] = useState(false);
  const [showUserProtagonistManager, setShowUserProtagonistManager] = useState(false);
  const [showPresetManager, setShowPresetManager] = useState(false);
  const [showConnectionManager, setShowConnectionManager] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [showHookManager, setShowHookManager] = useState(false);
  const [showArcEditor, setShowArcEditor] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showJoinRoom, setShowJoinRoom] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<"state" | "narrator">("state");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [immersiveMode, setImmersiveMode] = useState(() => shouldStartInImmersiveMode());
  const [immersivePanel, setImmersivePanel] = useState<ImmersivePanel>(null);

  const loadArc = useNarratorStore((s) => s.loadArc);
  const arc = useNarratorStore((s) => s.arc);
  const roomState = useRoomStore((s) => s.roomState);

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

  // Load narrator arc when session changes
  useEffect(() => {
    if (currentSessionId) {
      loadArc(currentSessionId);
    }
  }, [currentSessionId, loadArc]);

  const toggleImmersiveMode = () => {
    if (!immersiveMode && editMode) {
      toggleEditMode();
    }
    setMobileMenuOpen(false);
    setImmersivePanel(null);
    setImmersiveMode((value) => !value);
  };

  const toggleImmersivePanel = (panel: Exclude<ImmersivePanel, null>) => {
    setImmersiveMode(true);
    setMobileMenuOpen(false);
    setImmersivePanel((value) => (value === panel ? null : panel));
  };

  const handleNewSession = () => setShowStorySelector(true);

  const handleStorySelect = async (storyId: string, openerIndex: number, presetId?: string) => {
    setShowStorySelector(false);
    const session = await addSession(undefined, storyId, openerIndex, undefined, undefined, presetId);
    connectToSession(session.id);
  };

  const handleSkipStory = async (presetId?: string) => {
    setShowStorySelector(false);
    const session = await addSession(undefined, undefined, undefined, undefined, undefined, presetId);
    connectToSession(session.id);
  };

  const immersivePanelTitle =
    immersivePanel === "sessions" ? "会话与导航" :
    immersivePanel === "tools" ? "快捷工具" :
    immersivePanel === "narrator" ? "故事导演" :
    "状态板";

  return (
    <div className="app-layout h-[100dvh] flex flex-col w-full text-[var(--text-primary)]" data-immersive={immersiveMode ? "true" : "false"}>
      <Toasts />
      {!immersiveMode && <MapOverlay />}

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
      {showSettingsMenu && (
        <GameSettingManager onClose={() => setShowSettingsMenu(false)} />
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
      {showArcEditor && currentSessionId && (
        <ArcEditor sessionId={currentSessionId} onClose={() => setShowArcEditor(false)} />
      )}
      {showCreateRoom && currentSessionId && (
        <CreateRoomModal sessionId={currentSessionId} onClose={() => setShowCreateRoom(false)} />
      )}
      {showJoinRoom && (
        <JoinRoomModal onClose={() => setShowJoinRoom(false)} />
      )}
      {configOpen && <ConfigModal />}
      {showStorySelector && (        <StorySelector
          onSelect={handleStorySelect}
          onSkip={handleSkipStory}
          onCancel={() => setShowStorySelector(false)}
          onManagePresets={() => { setShowStorySelector(false); setShowPresetManager(true); }}
        />
      )}

      {immersiveMode && (
        <>
          <div className="fixed left-3 top-3 z-[70] flex flex-col gap-2 md:left-4 md:top-4">
            <FloatingIconButton
              icon={immersiveMode ? "⤢" : "⤡"}
              label={immersiveMode ? "退出沉浸模式" : "进入沉浸模式"}
              active={immersiveMode}
              onClick={toggleImmersiveMode}
            />
            <FloatingIconButton
              icon="☰"
              label="会话与导航"
              active={immersivePanel === "sessions"}
              onClick={() => toggleImmersivePanel("sessions")}
            />
            <FloatingIconButton
              icon="🧰"
              label="快捷工具"
              active={immersivePanel === "tools"}
              onClick={() => toggleImmersivePanel("tools")}
            />
            <FloatingIconButton
              icon="📊"
              label="状态板"
              active={immersivePanel === "state"}
              disabled={!currentSessionId}
              onClick={() => toggleImmersivePanel("state")}
            />
            <FloatingIconButton
              icon="🎬"
              label="故事导演"
              active={immersivePanel === "narrator"}
              disabled={!currentSessionId}
              onClick={() => toggleImmersivePanel("narrator")}
            />
          </div>

          {immersivePanel && (
            <div className="fixed left-16 right-3 top-3 bottom-3 z-[65] md:left-20 md:right-auto md:w-[380px] rounded-3xl border border-white/10 bg-slate-950/88 shadow-[0_28px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 bg-white/5">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--text-secondary)]">Immersive</div>
                  <div className="text-sm font-semibold text-white">{immersivePanelTitle}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setImmersivePanel(null)}
                  className="h-9 w-9 rounded-full text-lg text-[var(--text-secondary)] hover:bg-white/10 hover:text-white transition-colors"
                  aria-label="关闭浮层"
                >
                  ×
                </button>
              </div>

              <div className="h-[calc(100%-73px)] overflow-y-auto minimal-scrollbar">
                {immersivePanel === "sessions" && (
                  <div className="flex h-full flex-col p-3">
                    <SessionList
                      onNewSession={() => { handleNewSession(); setImmersivePanel(null); }}
                      onShowHistory={() => { setShowHistoryPanel(true); setImmersivePanel(null); }}
                      onManageStories={() => { setShowStoryManager(true); setImmersivePanel(null); }}
                      onManageProtagonists={() => { setShowProtagonistManager(true); setImmersivePanel(null); }}
                      onManageUserProtagonists={() => { setShowUserProtagonistManager(true); setImmersivePanel(null); }}
                      onManagePresets={() => { setShowPresetManager(true); setImmersivePanel(null); }}
                      onManageConnections={() => { setShowConnectionManager(true); setImmersivePanel(null); }}
                      onOpenSettings={() => { setShowSettingsMenu(true); setImmersivePanel(null); }}
                    />
                  </div>
                )}

                {immersivePanel === "tools" && (
                  <div className="space-y-4 p-4">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="mb-3 text-[12px] font-medium text-[var(--text-secondary)]">界面模式</div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className={`flex-1 rounded-xl px-3 py-2 text-[13px] font-medium transition-all ${
                            !editMode ? "bg-blue-600 text-white" : "bg-white/5 text-[var(--text-secondary)] hover:text-white"
                          }`}
                          onClick={() => { if (editMode) toggleEditMode(); }}
                        >
                          💬 聊天
                        </button>
                        <button
                          type="button"
                          className={`flex-1 rounded-xl px-3 py-2 text-[13px] font-medium transition-all ${
                            editMode ? "bg-blue-600 text-white" : "bg-white/5 text-[var(--text-secondary)] hover:text-white"
                          }`}
                          onClick={() => { if (!editMode) toggleEditMode(); }}
                        >
                          🎨 编辑
                        </button>
                      </div>
                    </div>

                    {currentSessionId && (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 space-y-3">
                        <div>
                          <div className="mb-2 text-[12px] font-medium text-[var(--text-secondary)]">预设</div>
                          <PresetSwitcher sessionId={currentSessionId} />
                        </div>
                        <div>
                          <div className="mb-2 text-[12px] font-medium text-[var(--text-secondary)]">连接</div>
                          <ConnectionSwitcher />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={!currentSessionId}
                        onClick={() => { setShowDebugPanel(true); setImmersivePanel(null); }}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left text-[13px] text-[var(--text-secondary)] transition-colors hover:text-white hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        🔍 调试
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowHookManager(true); setImmersivePanel(null); }}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left text-[13px] text-[var(--text-secondary)] transition-colors hover:text-white hover:bg-white/8"
                      >
                        🔗 Hooks
                      </button>
                      {!roomState && currentSessionId && (
                        <button
                          type="button"
                          onClick={() => { setShowCreateRoom(true); setImmersivePanel(null); }}
                          className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left text-[13px] text-[var(--text-secondary)] transition-colors hover:text-white hover:bg-white/8"
                        >
                          🎲 多人
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={!!roomState}
                        onClick={() => { setShowJoinRoom(true); setImmersivePanel(null); }}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left text-[13px] text-[var(--text-secondary)] transition-colors hover:text-white hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        🚪 加入
                      </button>
                      <button
                        type="button"
                        onClick={() => { setConfigOpen(true); setImmersivePanel(null); }}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left text-[13px] text-[var(--text-secondary)] transition-colors hover:text-white hover:bg-white/8"
                      >
                        ⚙️ 配置
                      </button>
                      <button
                        type="button"
                        onClick={logout}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left text-[13px] text-[var(--text-secondary)] transition-colors hover:text-red-300 hover:bg-red-500/10"
                      >
                        🚪 退出
                      </button>
                    </div>
                  </div>
                )}

                {immersivePanel === "state" && (
                  currentSessionId ? <div className="p-4"><StatePanel /></div> : <div className="p-4 text-sm text-[var(--text-secondary)]">请先选择一个会话。</div>
                )}

                {immersivePanel === "narrator" && (
                  currentSessionId ? (
                    <NarratorPanel
                      sessionId={currentSessionId}
                      onOpenEditor={() => { setShowArcEditor(true); setImmersivePanel(null); }}
                    />
                  ) : (
                    <div className="p-4 text-sm text-[var(--text-secondary)]">请先选择一个会话。</div>
                  )
                )}
              </div>
            </div>
          )}
        </>
      )}

      {!immersiveMode && (
        <div className="fixed right-3 top-3 z-[72] flex flex-col gap-2 md:hidden">
          <FloatingIconButton
            icon="⤡"
            label="进入沉浸模式"
            onClick={toggleImmersiveMode}
          />
          <FloatingIconButton
            icon="📊"
            label="打开状态板"
            active={statePanelOpen}
            disabled={!currentSessionId}
            onClick={toggleStatePanel}
          />
        </div>
      )}

      {/* 移动端顶部标题栏 */}
      <div className={`${immersiveMode ? "hidden" : "flex"} md:hidden items-center gap-2 bg-[var(--bg-secondary)] border-b border-[var(--border)] min-h-14 pl-3 pr-16 py-2 shrink-0`}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button 
            className="h-9 px-3 text-[var(--accent)] rounded-xl bg-white/5 hover:bg-[var(--bg-tertiary)] shrink-0"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="打开菜单"
          >
            ☰
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-secondary)]">Session</div>
            <span className="block font-bold text-sm truncate">
              {sessions.find(s => s.id === currentSessionId)?.title || 'Creative Chat'}
            </span>
          </div>
        </div>
        <div className="flex gap-1 text-sm shrink-0">
          <button
            className={`h-9 min-w-9 px-2 rounded-xl ${!editMode ? "bg-[var(--accent)] text-white" : "bg-white/5 text-[var(--text-secondary)]"}`}
            onClick={() => { if (editMode) toggleEditMode(); }}
            aria-label="切换到聊天模式"
          >
            💬
          </button>
          <button
            className={`h-9 min-w-9 px-2 rounded-xl ${editMode ? "bg-[var(--accent)] text-white" : "bg-white/5 text-[var(--text-secondary)]"}`}
            onClick={() => { if (!editMode) toggleEditMode(); }}
            aria-label="切换到编辑模式"
          >
            🎨
          </button>
        </div>
      </div>

      {/* 侧边栏/抽屉（包含所有导航项） */}
      <nav className={`${immersiveMode ? "hidden" : ""} top-nav flex-col md:flex-row md:flex transition-transform w-full ${mobileMenuOpen ? 'flex h-auto max-h-[50vh] overflow-y-auto w-full z-10 sticky top-0 shadow-lg border-b border-[var(--border)]' : 'hidden md:flex'}`}>
        <SessionList
          onNewSession={() => { handleNewSession(); setMobileMenuOpen(false); }}
          onShowHistory={() => { setShowHistoryPanel(true); setMobileMenuOpen(false); }}
          onManageStories={() => { setShowStoryManager(true); setMobileMenuOpen(false); }}
          onManageProtagonists={() => { setShowProtagonistManager(true); setMobileMenuOpen(false); }}
          onManageUserProtagonists={() => { setShowUserProtagonistManager(true); setMobileMenuOpen(false); }}
          onManagePresets={() => { setShowPresetManager(true); setMobileMenuOpen(false); }}
          onManageConnections={() => { setShowConnectionManager(true); setMobileMenuOpen(false); }}
          onOpenSettings={() => { setShowSettingsMenu(true); setMobileMenuOpen(false); }}
        />
      </nav>

      {/* Main */}
      <div className="main-content flex-1 flex flex-col min-h-0 bg-[var(--bg-primary)]">
        {/* PC端顶部工具栏 */}
        <div className={`${immersiveMode ? "hidden" : "hidden md:flex"} items-center h-12 border-b border-white/[0.08] px-4 gap-2 bg-[var(--bg-secondary)] shrink-0 relative z-10 shadow-sm`}>
          <button
            className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all border border-transparent ${!editMode ? "bg-blue-600 text-white shadow-sm ring-1 ring-white/10 ring-inset" : "text-[var(--text-secondary)] hover:text-white hover:bg-white/5"}`}
            onClick={() => { if (editMode) toggleEditMode(); }}
          >
            💬 聊天
          </button>
          <button
            className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all border border-transparent ${editMode ? "bg-blue-600 text-white shadow-sm ring-1 ring-white/10 ring-inset" : "text-[var(--text-secondary)] hover:text-white hover:bg-white/5"}`}
            onClick={() => { if (!editMode) toggleEditMode(); }}
          >
            🎨 编辑
          </button>
          <div className="flex-1" />
          {currentSessionId && <PresetSwitcher sessionId={currentSessionId} />}
          <div className="h-4 w-px bg-white/10 mx-1.5" />
          <ConnectionSwitcher />
          <div className="h-4 w-px bg-white/10 mx-1.5" />
          <button
            className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all flex items-center gap-1.5 ${rightPanelTab === "state" ? "bg-white/10 text-white ring-1 ring-inset ring-white/10 shadow-sm" : "border border-transparent text-[var(--text-secondary)] hover:text-white hover:bg-white/5"}`}
            onClick={() => setRightPanelTab("state")}
          >
            <span className="text-[14px]">📊</span> 状态
          </button>
          <button
            onClick={() => setShowDebugPanel(true)}
            disabled={!currentSessionId}
            className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 border border-transparent"
            title="调试 - 查看发送内容"
          >
            <span className="text-[14px]">🔍</span> 调试
          </button>
          <button
            onClick={() => setShowHookManager(true)}
            className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:text-white hover:bg-white/5 transition-all flex items-center gap-1.5 border border-transparent"
            title="Chat Hook 管理"
          >
            <span className="text-[14px]">🔗</span> Hooks
          </button>
          {/* Multiplayer buttons */}
          {!roomState && currentSessionId && (
            <button
              onClick={() => setShowCreateRoom(true)}
              className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:text-white hover:bg-white/5 transition-all flex items-center gap-1.5 border border-transparent"
              title="创建多人房间"
            >
              <span className="text-[14px]">🎲</span> 多人
            </button>
          )}
          <button
            onClick={() => setShowJoinRoom(true)}
            disabled={!!roomState}
            className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:text-white hover:bg-white/5 disabled:opacity-30 transition-all flex items-center gap-1.5 border border-transparent"
            title="加入多人房间"
          >
            <span className="text-[14px]">🚪</span> 加入
          </button>
          <button
            className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all flex items-center gap-1.5 ${
              rightPanelTab === "narrator" ? "bg-purple-600/20 text-purple-300 ring-1 ring-inset ring-purple-500/20" : "border border-transparent text-[var(--text-secondary)] hover:text-white hover:bg-white/5"
            }`}
            onClick={() => setRightPanelTab("narrator")}
            title="故事导演"
          >
            <span className="text-[14px]">🎬</span> 导演
          </button>
          <div className="h-4 w-px bg-white/10 mx-1.5" />
          <span className="text-[12px] text-[var(--text-secondary)] hidden lg:block">{user?.username}</span>
          <button
            onClick={logout}
            className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:text-red-400 hover:bg-white/5 transition-all flex items-center gap-1.5 border border-transparent"
            title="退出登录"
          >
            <span className="text-[14px]">🚪</span> 退出
          </button>
          <div className="h-4 w-px bg-white/10 mx-1.5" />
          <button
            onClick={() => setConfigOpen(true)}
            className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:text-white hover:bg-white/5 transition-all flex items-center gap-1.5 border border-transparent"
            title="配置"
          >
            <span className="text-[14px]">⚙️</span> 配置
          </button>
          <button
            onClick={toggleImmersiveMode}
            className="px-3 py-1.5 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:text-white hover:bg-white/5 transition-all flex items-center gap-1.5 border border-transparent"
            title="沉浸模式"
          >
            <span className="text-[14px]">⤡</span> 沉浸
          </button>
        </div>

        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            {editMode ? (
              <EditMode />
            ) : (
              <ChatView immersiveMode={immersiveMode} />
            )}
          </div>

            <aside className={`${immersiveMode ? "hidden" : ""} fixed md:static inset-0 z-50 md:z-auto bg-[var(--bg-secondary)] border-l border-[var(--border)] md:w-80 w-full flex-col transition-all ${statePanelOpen ? 'flex' : 'hidden'} md:flex`}>
              {/* 移动端 state面板返回按钮 */}
              <div className="md:hidden flex items-center bg-[var(--bg-secondary)] border-b border-[var(--border)] h-12 px-3 justify-between shrink-0 sticky top-0 z-10 w-full">
                 <span className="font-bold">{rightPanelTab === "narrator" ? "🎬 故事导演" : "📊 状态板"}</span>
                 <button onClick={toggleStatePanel} className="text-[var(--text-secondary)] text-2xl p-2 w-10 h-10 flex items-center justify-center rounded-full hover:bg-[var(--bg-tertiary)] active:bg-gray-700">×</button>
              </div>
              {/* Tab switcher */}
              <div className="hidden md:flex border-b border-[var(--border)] shrink-0">
                <button
                  onClick={() => setRightPanelTab("state")}
                  className={`flex-1 py-2 text-[12px] font-medium transition-all ${
                    rightPanelTab === "state"
                      ? "border-b-2 border-[var(--accent)] text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  📊 状态
                </button>
                <button
                  onClick={() => setRightPanelTab("narrator")}
                  className={`flex-1 py-2 text-[12px] font-medium transition-all flex items-center justify-center gap-1 ${
                    rightPanelTab === "narrator"
                      ? "border-b-2 border-purple-400 text-purple-300"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  🎬 导演
                  {arc && arc.enabled && (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                  )}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto w-full">
                {rightPanelTab === "state" ? (
                  <div className="p-4"><StatePanel /></div>
                ) : currentSessionId ? (
                  <NarratorPanel
                    sessionId={currentSessionId}
                    onOpenEditor={() => setShowArcEditor(true)}
                  />
                ) : null}
              </div>
            </aside>
        </div>
      </div>
    </div>
  );
}
