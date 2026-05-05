import { useState } from "react";
import { useRoomStore } from "../stores/roomStore";
import { useUIStore } from "../stores/uiStore";

interface Props {
  sessionId: string;
  onClose: () => void;
}

export default function CreateRoomModal({ sessionId, onClose }: Props) {
  const openRoom = useRoomStore((s) => s.openRoom);
  const addToast = useUIStore((s) => s.addToast);
  const [loading, setLoading] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const copyWithFallback = async (text: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.select();

    const succeeded = document.execCommand("copy");
    document.body.removeChild(textarea);

    if (!succeeded) {
      throw new Error("copy_failed");
    }
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const room = await openRoom(sessionId);
      setRoomCode(room.room_code);
    } catch (e: unknown) {
      addToast((e as Error).message || "创建房间失败", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!roomCode) return;
    try {
      await copyWithFallback(roomCode);
      setCopied(true);
      addToast("房间码已复制", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast("当前环境不支持自动复制，请手动复制房间码", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">创建多人房间</h2>

        {!roomCode ? (
          <>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              创建房间后，将生成一个 6 位房间码，邀请其他玩家加入同一会话。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-white/5 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium transition-colors"
              >
                {loading ? "创建中..." : "创建房间"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-[var(--text-secondary)] mb-3">房间已创建！将以下房间码分享给其他玩家：</p>
            <div
              className="flex items-center justify-between bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl px-4 py-3 mb-6 cursor-pointer hover:border-indigo-500/50 transition-colors group"
              onClick={handleCopy}
              title="点击复制"
            >
              <span className="text-2xl font-mono font-bold tracking-[0.25em] text-indigo-400">
                {roomCode}
              </span>
              <span className="text-xs text-[var(--text-secondary)] group-hover:text-indigo-400 transition-colors">
                {copied ? "✓ 已复制" : "点击复制"}
              </span>
            </div>
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
              >
                开始游戏
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
