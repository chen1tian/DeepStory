import { useEffect, useState } from "react";
import { useProtagonistStore } from "../stores/protagonistStore";
import { useSessionStore } from "../stores/sessionStore";
import { useUIStore } from "../stores/uiStore";
import AIAssistModal from "./AIAssistModal";
import type { Protagonist } from "../types";

const EMOJI_OPTIONS = ["🧑", "👩", "👨", "🧙", "🦸", "🧝", "🧛", "🥷", "👸", "🤴", "🧚", "🦹", "👼", "🐉", "🐺", "🦊"];

export default function ProtagonistManager({ onClose }: { onClose: () => void }) {
  const { protagonists, loading, fetchProtagonists, addProtagonist, editProtagonist, removeProtagonist, duplicateProtagonist } =
    useProtagonistStore();
  const currentSessionId = useSessionStore((s) => s.currentSessionId);
  const addCharacterToSession = useSessionStore((s) => s.addCharacterToSession);
  const addToast = useUIStore((s) => s.addToast);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copyTarget, setCopyTarget] = useState<Protagonist | null>(null);
  const [copyName, setCopyName] = useState("");

  useEffect(() => {
    fetchProtagonists();
  }, [fetchProtagonists]);

  const handleAdd = async () => {
    const p = await addProtagonist();
    setEditingId(p.id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此主角？")) return;
    await removeProtagonist(id);
    if (editingId === id) setEditingId(null);
  };

  const handleStartCopy = (p: Protagonist) => {
    setCopyName(p.name + " (副本)");
    setCopyTarget(p);
  };

  const handleConfirmCopy = async () => {
    if (!copyTarget || !copyName.trim()) return;
    await duplicateProtagonist(copyTarget.id, copyName.trim());
    setCopyTarget(null);
    setCopyName("");
  };

  const handleAddToSession = async (p: Protagonist) => {
    if (!currentSessionId) return;
    await addCharacterToSession(currentSessionId, { pool_id: p.id });
    addToast(`「${p.name}」已加入当前对话`, "success");
  };

  const editingProtagonist = protagonists.find((p) => p.id === editingId);

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center animate-[fadeIn_0.15s_ease-out]" onClick={onClose}>
      <div className="w-[90vw] max-w-[1000px] h-[80vh] bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-3 bg-[var(--bg-secondary)]">
          <h2 className="text-base font-semibold">🎭 角色池</h2>
          <button className="bg-indigo-500 hover:bg-indigo-400 text-white px-3 py-1.5 rounded-lg text-[13px] cursor-pointer border-none transition-colors" onClick={handleAdd}>
            + 新建角色
          </button>
          <div className="flex-1" />
          <button className="bg-transparent border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] px-3 py-1.5 rounded-lg text-[13px] cursor-pointer transition-colors" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="flex flex-1 overflow-hidden">
          {/* Left: protagonist list */}
          <div className="w-[300px] min-w-[300px] border-r border-[var(--border)] overflow-y-auto p-3 minimal-scrollbar">
            {loading && <div className="text-sm text-[var(--text-secondary)] p-3">加载中…</div>}
            {!loading && protagonists.length === 0 && (
              <div className="text-sm text-[var(--text-secondary)] p-3">暂无角色，点击上方按钮创建</div>
            )}
            {protagonists.map((p) => (
              <div
                key={p.id}
                className={`p-3 rounded-lg border-l-[3px] border-l-[var(--accent)] bg-[var(--bg-surface)] mb-2 cursor-pointer relative transition-colors hover:bg-[var(--bg-tertiary)] group${p.id === editingId ? " ring-1 ring-[var(--accent)] bg-[var(--bg-tertiary)]" : ""}`}
                onClick={() => setEditingId(p.id)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">{p.avatar_emoji}</span>
                  <span className="text-[13px] font-medium text-[var(--text-primary)] flex-1 truncate">{p.name || "未命名角色"}</span>
                  {p.is_default && <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-full font-medium">默认主角</span>}
                </div>
                <div className="text-[12px] text-[var(--text-secondary)] leading-relaxed line-clamp-2 mb-1.5">
                  {p.setting ? (p.setting.length > 60 ? p.setting.slice(0, 60) + "…" : p.setting) : "暂无设定"}
                </div>
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] px-2 py-0.5 rounded text-xs hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                    title="复制角色"
                    onClick={() => handleStartCopy(p)}
                  >
                    📋
                  </button>
                  {currentSessionId && (
                    <button
                      className="bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] px-2 py-0.5 rounded text-xs hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                      title="加入当前对话"
                      onClick={() => handleAddToSession(p)}
                    >
                      💬 加入对话
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
          <div className="flex-1 overflow-y-auto p-5 minimal-scrollbar">
            {editingProtagonist ? (
              <ProtagonistForm
                key={editingProtagonist.id}
                protagonist={editingProtagonist}
                onSave={(data) => editProtagonist(editingProtagonist.id, data)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)] gap-3">
                <div className="text-5xl opacity-30">🎭</div>
                <div>选择或新建一个角色来编辑</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Copy dialog */}
      {copyTarget && (
        <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center" onClick={() => setCopyTarget(null)}>
          <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl p-5 w-80 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-sm font-semibold">复制角色</h4>
            <p className="text-xs text-[var(--text-secondary)]">为复制的角色命名：</p>
            <input
              autoFocus
              className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm font-[inherit] outline-none focus:border-indigo-500/60 transition-colors w-full"
              value={copyName}
              onChange={(e) => setCopyName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirmCopy()}
              placeholder="角色名称"
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
  is_default: boolean;
}

function ProtagonistForm({
  protagonist,
  onSave,
}: {
  protagonist: Protagonist;
  onSave: (data: Partial<FormData>) => Promise<unknown>;
}) {
  const [form, setForm] = useState<FormData>({
    name: protagonist.name,
    setting: protagonist.setting,
    avatar_emoji: protagonist.avatar_emoji || "🧑",
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
          <label className="text-[13px] font-medium text-[var(--text-secondary)]">角色设定</label>
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
          placeholder="描述主角的性格、背景、特长、行为习惯等…"
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
