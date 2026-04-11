import { useEffect, useState } from "react";
import { useSessionStore } from "../stores/sessionStore";
import { useProtagonistStore } from "../stores/protagonistStore";
import { useUIStore } from "../stores/uiStore";
import type { SessionCharacter } from "../types";

const EMOJI_OPTIONS = ["🧑", "👩", "👨", "🧙", "🦸", "🧝", "🧛", "🥷", "👸", "🤴", "🧚", "🦹", "👼", "🐉", "🐺", "🦊"];

export default function SessionCharactersPanel() {
  const currentSessionId = useSessionStore((s) => s.currentSessionId);
  const sessions = useSessionStore((s) => s.sessions);
  const {
    fetchSessionCharacters,
    addCharacterToSession,
    updateCharacterInSession,
    removeCharacterFromSession,
    copyCharacterInSession,
    pushCharacterToPool,
    pullCharacterFromPool,
  } = useSessionStore();
  const addToast = useUIStore((s) => s.addToast);

  const session = sessions.find((s) => s.id === currentSessionId);
  const characters: SessionCharacter[] = session?.characters ?? [];

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [copyTarget, setCopyTarget] = useState<SessionCharacter | null>(null);
  const [copyName, setCopyName] = useState("");

  useEffect(() => {
    if (currentSessionId) {
      fetchSessionCharacters(currentSessionId);
    }
  }, [currentSessionId, fetchSessionCharacters]);

  if (!currentSessionId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)] gap-3 p-8">
        <div className="text-5xl opacity-30">👥</div>
        <div>选择或新建一个对话来管理角色</div>
      </div>
    );
  }

  const handleDelete = async (char: SessionCharacter) => {
    if (!confirm(`确定从对话中移除「${char.name}」？`)) return;
    await removeCharacterFromSession(currentSessionId, char.id);
    if (expandedId === char.id) setExpandedId(null);
  };

  const handlePushToPool = async (char: SessionCharacter) => {
    try {
      await pushCharacterToPool(currentSessionId, char.id);
      addToast(`「${char.name}」已保存到角色池`, "success");
    } catch {
      addToast("保存到角色池失败", "error");
    }
  };

  const handlePullFromPool = async (char: SessionCharacter) => {
    try {
      await pullCharacterFromPool(currentSessionId, char.id);
      addToast(`已从角色池同步「${char.name}」的资料`, "success");
    } catch {
      addToast("从角色池读取失败", "error");
    }
  };

  const handleStartCopy = (char: SessionCharacter) => {
    setCopyName(char.name + " (副本)");
    setCopyTarget(char);
  };

  const handleConfirmCopy = async () => {
    if (!copyTarget || !copyName.trim()) return;
    await copyCharacterInSession(currentSessionId, copyTarget.id, copyName.trim());
    setCopyTarget(null);
    setCopyName("");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-[var(--border)] flex items-center justify-between">
        <h3 className="text-[13px] font-semibold">👥 对话角色</h3>
        <button
          className="bg-indigo-500 hover:bg-indigo-400 text-white px-2.5 py-1 rounded-md text-xs cursor-pointer border-none transition-colors"
          onClick={() => setShowAddModal(true)}
        >
          + 添加角色
        </button>
      </div>

      {characters.length === 0 ? (
        <div className="text-xs text-[var(--text-secondary)] p-3">
          尚未添加角色。点击「添加角色」从角色池选择，或手动创建新角色。
        </div>
      ) : (
        <div className="flex flex-col overflow-y-auto minimal-scrollbar">
          {characters.map((char) => (
            <CharacterItem
              key={char.id}
              char={char}
              expanded={expandedId === char.id}
              onToggleExpand={() => setExpandedId(expandedId === char.id ? null : char.id)}
              onSave={(data) => updateCharacterInSession(currentSessionId, char.id, data)}
              onDelete={() => handleDelete(char)}
              onCopy={() => handleStartCopy(char)}
              onPushToPool={() => handlePushToPool(char)}
              onPullFromPool={() => handlePullFromPool(char)}
            />
          ))}
        </div>
      )}

      {showAddModal && (
        <AddCharacterModal
          sessionId={currentSessionId}
          onAdd={addCharacterToSession}
          onClose={() => setShowAddModal(false)}
        />
      )}

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

/* ───────────────── Character Item ───────────────── */

interface CharacterItemProps {
  char: SessionCharacter;
  expanded: boolean;
  onToggleExpand: () => void;
  onSave: (data: { name?: string; setting?: string; avatar_emoji?: string }) => Promise<unknown>;
  onDelete: () => void;
  onCopy: () => void;
  onPushToPool: () => void;
  onPullFromPool: () => void;
}

function CharacterItem({
  char,
  expanded,
  onToggleExpand,
  onSave,
  onDelete,
  onCopy,
  onPushToPool,
  onPullFromPool,
}: CharacterItemProps) {
  const [form, setForm] = useState({ name: char.name, setting: char.setting, avatar_emoji: char.avatar_emoji });
  const [saving, setSaving] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  useEffect(() => {
    setForm({ name: char.name, setting: char.setting, avatar_emoji: char.avatar_emoji });
  }, [char]);

  const update = <K extends keyof typeof form>(key: K, val: (typeof form)[K]) =>
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
    <div className={`border-b border-[var(--border)] transition-colors ${expanded ? "bg-[var(--bg-secondary)]" : "hover:bg-[var(--bg-secondary)/50]"}`}>
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-lg">{char.avatar_emoji}</span>
        <span className="text-[13px] font-medium text-[var(--text-primary)] flex-1 truncate">{char.name || "未命名角色"}</span>
        {char.pool_id && <span className="text-xs opacity-50" title="已关联角色池">🔗</span>}
        <div className="flex gap-1 shrink-0">
          <button
            className="bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] px-2 py-0.5 rounded text-xs cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors"
            title="编辑"
            onClick={onToggleExpand}
          >
            ✏️
          </button>
          <button
            className="bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] px-2 py-0.5 rounded text-xs cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors"
            title="复制角色"
            onClick={onCopy}
          >
            📋
          </button>
          <button
            className="bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] px-2 py-0.5 rounded text-xs cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors"
            title="推送到角色池"
            onClick={onPushToPool}
          >
            ⬆️
          </button>
          {char.pool_id && (
            <button
              className="bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] px-2 py-0.5 rounded text-xs cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors"
              title="从角色池读取"
              onClick={onPullFromPool}
            >
              ⬇️
            </button>
          )}
          <button
            className="bg-transparent border border-red-500/40 text-red-400 px-2 py-0.5 rounded text-xs cursor-pointer hover:bg-red-500/10 transition-colors"
            title="移除"
            onClick={onDelete}
          >
            🗑
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-3 py-3 border-t border-[var(--border)] bg-[var(--bg-primary)] flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-[var(--text-secondary)]">头像</label>
            <div style={{ position: "relative" }}>
              <button
                className="text-2xl bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg w-10 h-10 cursor-pointer hover:border-indigo-500/50 transition-colors"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                {form.avatar_emoji}
              </button>
              {showEmojiPicker && (
                <div className="absolute top-full left-0 mt-1 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg p-2 grid grid-cols-8 gap-1 z-10 shadow-xl">
                  {EMOJI_OPTIONS.map((e) => (
                    <button
                      key={e}
                      className={`text-xl p-1.5 rounded cursor-pointer transition-colors ${e === form.avatar_emoji ? "bg-indigo-500/20 ring-1 ring-indigo-500/50" : "hover:bg-[var(--bg-tertiary)]"}`}
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
            <label className="text-[11px] text-[var(--text-secondary)]">名称</label>
            <input
              className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm font-[inherit] outline-none focus:border-indigo-500/60 transition-colors w-full"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="角色名称"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-[var(--text-secondary)]">角色设定</label>
            <textarea
              className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm font-[inherit] outline-none focus:border-indigo-500/60 transition-colors w-full resize-y"
              value={form.setting}
              onChange={(e) => update("setting", e.target.value)}
              placeholder="描述角色的性格、背景、特长、行为习惯等…"
              rows={6}
            />
          </div>
          <div className="flex justify-end">
            <button
              className="bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2 rounded-lg text-[13px] cursor-pointer border-none transition-colors disabled:opacity-50"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "保存中…" : "💾 保存"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────── Add Character Modal ───────────────── */

interface AddCharacterModalProps {
  sessionId: string;
  onAdd: (sessionId: string, data: { pool_id?: string | null; name?: string; setting?: string; avatar_emoji?: string }) => Promise<SessionCharacter>;
  onClose: () => void;
}

function AddCharacterModal({ sessionId, onAdd, onClose }: AddCharacterModalProps) {
  const protagonists = useProtagonistStore((s) => s.protagonists);
  const fetchProtagonists = useProtagonistStore((s) => s.fetchProtagonists);
  const [tab, setTab] = useState<"pool" | "new">("pool");
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const [newForm, setNewForm] = useState({ name: "新角色", setting: "", avatar_emoji: "🧑" });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchProtagonists();
  }, [fetchProtagonists]);

  const handleAddFromPool = async () => {
    if (!selectedPoolId) return;
    setAdding(true);
    try {
      await onAdd(sessionId, { pool_id: selectedPoolId });
      onClose();
    } finally {
      setAdding(false);
    }
  };

  const handleAddNew = async () => {
    setAdding(true);
    try {
      await onAdd(sessionId, { ...newForm, pool_id: null });
      onClose();
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center" onClick={onClose}>
      <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl w-[420px] max-h-[80vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <h4 className="text-sm font-semibold">添加角色</h4>
          <button
            className="bg-transparent border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] px-3 py-1 rounded-lg text-xs cursor-pointer transition-colors"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="flex border-b border-[var(--border)]">
          <button
            className={`flex-1 px-4 py-2.5 text-xs cursor-pointer border-none transition-colors ${tab === "pool" ? "bg-indigo-500/10 text-indigo-400 border-b-2 border-b-indigo-500" : "bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
            onClick={() => setTab("pool")}
          >
            📚 从角色池选择
          </button>
          <button
            className={`flex-1 px-4 py-2.5 text-xs cursor-pointer border-none transition-colors ${tab === "new" ? "bg-indigo-500/10 text-indigo-400 border-b-2 border-b-indigo-500" : "bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
            onClick={() => setTab("new")}
          >
            ✨ 手动创建
          </button>
        </div>

        {tab === "pool" && (
          <div className="flex flex-col gap-1 p-3 overflow-y-auto minimal-scrollbar">
            {protagonists.length === 0 && (
              <div className="text-xs text-[var(--text-secondary)] py-3 text-center">角色池为空，请先在「🎭 主角」中创建角色</div>
            )}
            {protagonists.map((p) => (
              <div
                key={p.id}
                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${selectedPoolId === p.id ? "bg-[var(--bg-surface)] ring-1 ring-indigo-500/50" : "hover:bg-[var(--bg-surface)]"}`}
                onClick={() => setSelectedPoolId(p.id)}
              >
                <span className="text-sm">{p.avatar_emoji}</span>
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">{p.name}</div>
                  <div className="text-xs text-[var(--text-secondary)] truncate">
                    {p.setting ? (p.setting.length > 60 ? p.setting.slice(0, 60) + "…" : p.setting) : "暂无设定"}
                  </div>
                </div>
              </div>
            ))}
            <div className="pt-3 flex justify-end">
              <button
                className="bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2 rounded-lg text-[13px] cursor-pointer border-none transition-colors disabled:opacity-50"
                onClick={handleAddFromPool}
                disabled={!selectedPoolId || adding}
              >
                {adding ? "添加中…" : "加入对话"}
              </button>
            </div>
          </div>
        )}

        {tab === "new" && (
          <div className="flex flex-col gap-3 p-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-[var(--text-secondary)]">名称</label>
              <input
                className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm font-[inherit] outline-none focus:border-indigo-500/60 transition-colors w-full"
                value={newForm.name}
                onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="角色名称"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-[var(--text-secondary)]">角色设定</label>
              <textarea
                className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm font-[inherit] outline-none focus:border-indigo-500/60 transition-colors w-full resize-y"
                value={newForm.setting}
                onChange={(e) => setNewForm((f) => ({ ...f, setting: e.target.value }))}
                placeholder="描述角色的性格、背景等…"
                rows={5}
              />
            </div>
            <div className="flex justify-end">
              <button
                className="bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2 rounded-lg text-[13px] cursor-pointer border-none transition-colors disabled:opacity-50"
                onClick={handleAddNew}
                disabled={!newForm.name.trim() || adding}
              >
                {adding ? "添加中…" : "加入对话"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
