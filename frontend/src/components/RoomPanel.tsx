import { useState } from "react";
import { useRoomStore } from "../stores/roomStore";
import { useAuthStore } from "../stores/authStore";
import { useUIStore } from "../stores/uiStore";

export default function RoomPanel() {
  const roomState = useRoomStore((s) => s.roomState);
  const isProcessing = useRoomStore((s) => s.isProcessing);
  const exitRoom = useRoomStore((s) => s.exitRoom);
  const user = useAuthStore((s) => s.user);
  const addToast = useUIStore((s) => s.addToast);
  const [exiting, setExiting] = useState(false);
  const [showCode, setShowCode] = useState(false);

  if (!roomState) return null;

  const isHost = user?.id === roomState.host_user_id;
  const myPlayer = roomState.players.find((p) => p.user_id === user?.id);

  const handleExit = async () => {
    setExiting(true);
    try {
      await exitRoom();
    } catch {
      addToast("退出房间失败", "error");
    } finally {
      setExiting(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomState.room_code);
    addToast("房间码已复制", "info");
  };

  return (
    <div className="bg-[var(--bg-surface)] border-b border-[var(--border)] px-4 py-2 flex items-center gap-3 flex-wrap">
      {/* Room code badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--text-secondary)]">房间</span>
        <button
          onClick={() => setShowCode((v) => !v)}
          className="font-mono text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
          title="显示/隐藏房间码"
        >
          {showCode ? roomState.room_code : "••••••"}
        </button>
        <button
          onClick={handleCopyCode}
          className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          title="复制房间码"
        >
          复制
        </button>
      </div>

      <div className="h-4 w-px bg-[var(--border)]" />

      {/* Player list */}
      <div className="flex items-center gap-2 flex-1 flex-wrap">
        {roomState.players.map((p) => (
          <div
            key={p.user_id}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-all ${
              p.is_online
                ? "bg-white/5 text-[var(--text-primary)]"
                : "bg-white/[0.02] text-[var(--text-secondary)] opacity-60"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                p.is_online ? "bg-green-500" : "bg-gray-500"
              }`}
            />
            <span>{p.protagonist_name || p.username}</span>
            {p.is_host && (
              <span className="text-yellow-500 text-[10px]" title="房主">
                ♛
              </span>
            )}
            {p.has_submitted && !isProcessing && (
              <span className="text-green-400 text-[10px]" title="已提交">
                ✓
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Status */}
      {isProcessing && (
        <span className="text-xs text-indigo-400 animate-pulse">DM 正在叙述...</span>
      )}
      {!isProcessing && roomState.round_status === "collecting" && (
        <span className="text-xs text-[var(--text-secondary)]">
          {roomState.players.filter((p) => p.is_online && p.has_submitted).length}/
          {roomState.players.filter((p) => p.is_online).length} 已提交
        </span>
      )}

      {/* Exit */}
      <button
        onClick={handleExit}
        disabled={exiting}
        className="ml-auto text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
      >
        {isHost ? "关闭房间" : "退出房间"}
      </button>
    </div>
  );
}
