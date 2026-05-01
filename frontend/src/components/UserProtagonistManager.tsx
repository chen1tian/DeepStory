import { useEffect, useState } from "react";
import { useUserProtagonistStore } from "../stores/userProtagonistStore";
import { useSessionStore } from "../stores/sessionStore";
import { useUIStore } from "../stores/uiStore";
import AIAssistModal from "./AIAssistModal";
import ImagePicker from "./ImagePicker";
import type { UserProtagonist } from "../types";

const EMOJI_OPTIONS = ["🧑", "👩", "👨", "🧙", "🦸", "🧝", "🧛", "🥷", "👸", "🤴", "🧚", "🦹", "👼", "🐉", "🐺", "🦊"];

export default function UserProtagonistManager({ onClose }: { onClose: () => void }) {
  const { userProtagonists, loading, fetchUserProtagonists, addUserProtagonist, editUserProtagonist, removeUserProtagonist, duplicateUserProtagonist } =
    useUserProtagonistStore();
  const currentSessionId = useSessionStore((s) => s.currentSessionId);
  const sessions = useSessionStore((s) => s.sessions);
  const setSessionProtagonist = useSessionStore((s) => s.setSessionProtagonist);
  const addToast = useUIStore((s) => s.addToast);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copyTarget, setCopyTarget] = useState<UserProtagonist | null>(null);
  const [copyName, setCopyName] = useState("");

  const currentSession = currentSessionId ? sessions.find((s) => s.id === currentSessionId) : null;

  useEffect(() => {
    fetchUserProtagonists();
  }, [fetchUserProtagonists]);

  const handleAdd = async () => {
    const p = await addUserProtagonist();
    setEditingId(p.id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此主角？")) return;
    await removeUserProtagonist(id);
    if (editingId === id) setEditingId(null);
  };

  const handleStartCopy = (p: UserProtagonist) => {
    setCopyName(p.name + " (副本)");
    setCopyTarget(p);
  };

  const handleConfirmCopy = async () => {
    if (!copyTarget || !copyName.trim()) return;
    await duplicateUserProtagonist(copyTarget.id, copyName.trim());
    setCopyTarget(null);
    setCopyName("");
  };

  const handleUseInSession = async (p: UserProtagonist) => {
    if (!currentSessionId) return;
    await setSessionProtagonist(currentSessionId, p.id);
    addToast(`已将「${p.name}」设为当前对话的主角`, "success");
  };

  const editingProtagonist = userProtagonists.find((p) => p.id === editingId);

  const isCurrentSessionProtagonist = (id: string) =>
    currentSession?.user_protagonist_id === id;

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center animate-[fadeIn_0.15s_ease-out]" onClick={onClose}>
      <div className="w-[calc(100vw-1rem)] max-w-[1000px] h-[calc(100dvh-1rem)] md:w-[90vw] md:h-[80vh] bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 md:px-5 md:py-4 border-b border-[var(--border)] flex flex-wrap items-center gap-3 bg-[var(--bg-secondary)]">
          <h2 className="text-base font-semibold">🎭 主角池</h2>
          <button className="bg-indigo-500 hover:bg-indigo-400 text-white px-3 py-1.5 rounded-lg text-[13px] cursor-pointer border-none transition-colors" onClick={handleAdd}>
            + 新建主角
          </button>
          <div className="hidden md:block flex-1" />
          <button className="bg-transparent border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] px-3 py-1.5 rounded-lg text-[13px] cursor-pointer transition-colors" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="flex flex-1 flex-col md:flex-row overflow-hidden min-h-0">
          {/* Left: protagonist list */}
          <div className="w-full md:w-[300px] md:min-w-[300px] border-b md:border-b-0 md:border-r border-[var(--border)] overflow-y-auto p-3 minimal-scrollbar max-h-[38vh] md:max-h-none">
            {loading && <div className="text-sm text-[var(--text-secondary)] p-3">加载中…</div>}
            {!loading && userProtagonists.length === 0 && (
              <div className="text-sm text-[var(--text-secondary)] p-3">暂无主角，点击上方按钮创建</div>
            )}
            {userProtagonists.map((p) => (
              <div
                key={p.id}
                className={`p-3 rounded-lg border-l-[3px] border-l-[var(--accent)] bg-[var(--bg-surface)] mb-2 cursor-pointer relative transition-colors hover:bg-[var(--bg-tertiary)] group${p.id === editingId ? " ring-1 ring-[var(--accent)] bg-[var(--bg-tertiary)]" : ""}`}
                onClick={() => setEditingId(p.id)}
              >
                <div className="flex items-center gap-2 mb-1">
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />
                  ) : (
                    <span className="text-base">{p.avatar_emoji}</span>
                  )}
                  <span className="text-[13px] font-medium text-[var(--text-primary)] flex-1 truncate">{p.name || "未命名主角"}</span>
                  {p.is_default && <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-full font-medium">默认主角</span>}
                  {isCurrentSessionProtagonist(p.id) && (
                    <span className="text-[10px] bg-[var(--accent)]/20 text-[var(--accent)] px-1.5 py-0.5 rounded-full font-medium">
                      当前对话
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-[var(--text-secondary)] leading-relaxed line-clamp-2 mb-1.5">
                  {p.setting ? (p.setting.length > 60 ? p.setting.slice(0, 60) + "…" : p.setting) : "暂无设定"}
                </div>
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] px-2 py-0.5 rounded text-xs hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                    title="复制主角"
                    onClick={() => handleStartCopy(p)}
                  >
                    📋
                  </button>
                  {currentSessionId && (
                    <button
                      className="bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] px-2 py-0.5 rounded text-xs hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer disabled:opacity-50"
                      title="设为当前对话主角"
                      onClick={() => handleUseInSession(p)}
                      disabled={isCurrentSessionProtagonist(p.id)}
                    >
                      🎭 {isCurrentSessionProtagonist(p.id) ? "已使用" : "使用"}
                    </button>
                  )}
                  <button
                    className="ml-auto bg-transparent border-none cursor-pointer text-sm opacity-0 group-hover:opacity-100 transition-opacity p-0 leading-none"
                    onClick={() => handleDelete(p.id)}
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Right: edit form */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-5 minimal-scrollbar">
            {editingProtagonist ? (
              <UserProtagonistForm
                key={editingProtagonist.id}
                protagonist={editingProtagonist}
                onSave={(data) => editUserProtagonist(editingProtagonist.id, data)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[180px] text-[var(--text-secondary)] gap-3 text-center px-4">
                <div className="text-4xl md:text-5xl opacity-30">🎭</div>
                <div className="max-w-[16rem] leading-relaxed">选择或新建一个主角来编辑</div>
                <div className="text-[13px] text-[var(--text-secondary)] opacity-70 mt-2 max-w-[18rem] leading-relaxed">
                  主角是你的化身，在聊天时代入你的设定
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Copy dialog */}
      {copyTarget && (
        <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center" onClick={() => setCopyTarget(null)}>
          <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl p-5 w-80 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-sm font-semibold">复制主角</h4>
            <p className="text-xs text-[var(--text-secondary)]">为复制的主角命名：</p>
            <input
              autoFocus
              className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm font-[inherit] outline-none focus:border-indigo-500/60 transition-colors w-full"
              value={copyName}
              onChange={(e) => setCopyName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirmCopy()}
              placeholder="主角名称"
            />
            <div className="flex justify-end gap-2">
              <button
                className="bg-transparent border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] px-4 py-2 rounded-lg text-[13px] cursor-pointer transition-colors"
                onClick={() => setCopyTarget(null)}
              >
                取消
              </button>
              <button
                className="bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2 rounded-lg text-[13px] cursor-pointer border-none transition-colors disabled:opacity-50"
                onClick={handleConfirmCopy}
                disabled={!copyName.trim()}
              >
                确认复制
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Inline form component ---- */

interface FormData {
  name: string;
  setting: string;
  avatar_emoji: string;
  avatar_url: string | null;
  is_default: boolean;
}

function UserProtagonistForm({
  protagonist,
  onSave,
}: {
  protagonist: UserProtagonist;
  onSave: (data: Partial<FormData>) => Promise<unknown>;
}) {
  const [form, setForm] = useState<FormData>({
    name: protagonist.name,
    setting: protagonist.setting,
    avatar_emoji: protagonist.avatar_emoji || "🧑",
    avatar_url: protagonist.avatar_url ?? null,
    is_default: protagonist.is_default,
  });
  const [saving, setSaving] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [aiAssist, setAiAssist] = useState<{
    fieldType: string;
    original: string;
  } | null>(null);

  const handleAiResult = (text: string) => {
    if (aiAssist?.fieldType === "protagonist") {
      update("setting", text);
    }
  };

  const update = <K extends keyof FormData>(key: K, val: FormData[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-[var(--text-secondary)]">头像</label>
        <div className="flex items-start gap-4">
          <ImagePicker
            value={form.avatar_url}
            onChange={(url) => update("avatar_url", url)}
            promptHint={form.name + "的角色形象"}
            size={96}
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] text-[var(--text-secondary)]">或选择 Emoji</span>
            <div style={{ position: "relative" }}>
              <button
                className="text-2xl bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                {form.avatar_emoji}
              </button>
              {showEmojiPicker && (
                <div className="absolute top-full left-0 mt-1 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg p-2 grid grid-cols-8 gap-1 z-10 shadow-lg">
                  {EMOJI_OPTIONS.map((e) => (
                    <button
                      key={e}
                      className={`text-xl p-1.5 rounded cursor-pointer border-none transition-colors hover:bg-[var(--bg-surface)]${e === form.avatar_emoji ? " bg-indigo-500/20" : " bg-transparent"}`}
                      onClick={() => {
                        update("avatar_emoji", e);
                        setShowEmojiPicker(false);
                      }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-[var(--text-secondary)]">名称</label>
        <input
          className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm font-[inherit] outline-none focus:border-indigo-500/60 transition-colors w-full"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="主角名称"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[13px] font-medium text-[var(--text-secondary)]">主角设定</label>
          <button
            className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20 px-2.5 py-1 rounded-md cursor-pointer text-xs transition-colors"
            onClick={() => setAiAssist({ fieldType: "protagonist", original: form.setting })}
          >
            ✨ AI 润色
          </button>
        </div>
        <textarea
          className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm font-[inherit] outline-none focus:border-indigo-500/60 transition-colors w-full resize-none"
          value={form.setting}
          onChange={(e) => update("setting", e.target.value)}
          placeholder="描述你的角色身份、性格、背景、口头禅等…聊天时会以此定义你的化身"
          rows={10}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-2 text-[13px] font-medium text-[var(--text-secondary)] cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_default}
            onChange={(e) => update("is_default", e.target.checked)}
          />
          设为默认主角（新对话自动使用）
        </label>
      </div>

      <div className="pt-2 flex justify-end">
        <button
          className="bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2 rounded-lg text-[13px] cursor-pointer border-none transition-colors disabled:opacity-50"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "保存中…" : "💾 保存"}
        </button>
      </div>

      {aiAssist && (
        <AIAssistModal
          original={aiAssist.original}
          fieldType={aiAssist.fieldType}
          onAccept={handleAiResult}
          onClose={() => setAiAssist(null)}
        />
      )}
    </div>
  );
}
