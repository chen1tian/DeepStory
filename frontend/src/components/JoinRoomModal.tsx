import { useState } from "react";
import { useRoomStore } from "../stores/roomStore";
import { useSessionStore } from "../stores/sessionStore";
import { useChatStore } from "../stores/chatStore";
import { useUIStore } from "../stores/uiStore";

interface Props {
  onClose: () => void;
}

export default function JoinRoomModal({ onClose }: Props) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const joinRoom = useRoomStore((s) => s.joinRoom);
  const selectSession = useSessionStore((s) => s.selectSession);
  const connectToSession = useChatStore((s) => s.connectToSession);
  const addToast = useUIStore((s) => s.addToast);

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) {
      addToast("请输入 6 位房间码", "error");
      return;
    }
    setLoading(true);
    try {
      const sessionId = await joinRoom(trimmed);
      // Switch to the host's session
      selectSession(sessionId);
      connectToSession(sessionId);
      onClose();
    } catch (e: unknown) {
      addToast((e as Error).message || "加入房间失败", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">加入多人房间</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-4">输入房主提供的 6 位房间码加入游戏。</p>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          maxLength={6}
          placeholder="XXXXXX"
          className="w-full bg-[var(--bg-primary)] border border-[var(--border)] focus:border-indigo-500 rounded-xl px-4 py-3 text-xl font-mono text-center tracking-[0.3em] text-[var(--text-primary)] outline-none transition-colors mb-6"
        />
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-white/5 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleJoin}
            disabled={loading || code.trim().length !== 6}
            className="px-4 py-2 rounded-lg text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium transition-colors"
          >
            {loading ? "加入中..." : "加入房间"}
          </button>
        </div>
      </div>
    </div>
  );
}
