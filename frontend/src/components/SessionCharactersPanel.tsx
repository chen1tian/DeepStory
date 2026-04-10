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
      <div className="characters-panel-empty">
        <div className="icon">👥</div>
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
    <div className="characters-panel">
      <div className="characters-panel-header">
        <h3>👥 对话角色</h3>
        <button className="btn" onClick={() => setShowAddModal(true)}>
          + 添加角色
        </button>
      </div>

      {characters.length === 0 ? (
        <div className="characters-panel-hint">
          尚未添加角色。点击「添加角色」从角色池选择，或手动创建新角色。
        </div>
      ) : (
        <div className="characters-list">
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
        <div className="char-copy-overlay" onClick={() => setCopyTarget(null)}>
          <div className="char-copy-dialog" onClick={(e) => e.stopPropagation()}>
            <h4>复制角色</h4>
            <p>为复制的角色命名：</p>
            <input
              autoFocus
              value={copyName}
              onChange={(e) => setCopyName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirmCopy()}
              placeholder="角色名称"
            />
            <div className="char-copy-actions">
              <button className="btn" onClick={handleConfirmCopy} disabled={!copyName.trim()}>
                确认复制
              </button>
              <button className="btn-ghost btn" onClick={() => setCopyTarget(null)}>
                取消
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
    <div className={`char-item ${expanded ? "expanded" : ""}`}>
      <div className="char-item-row">
        <span className="protagonist-avatar">{char.avatar_emoji}</span>
        <span className="char-item-name">{char.name || "未命名角色"}</span>
        {char.pool_id && <span className="char-pool-badge" title="已关联角色池">🔗</span>}
        <div className="char-item-actions">
          <button
            className="btn-small"
            title="编辑"
            onClick={onToggleExpand}
          >
            ✏️
          </button>
          <button className="btn-small" title="复制角色" onClick={onCopy}>
            📋
          </button>
          <button className="btn-small" title="推送到角色池" onClick={onPushToPool}>
            ⬆️
          </button>
          {char.pool_id && (
            <button className="btn-small" title="从角色池读取" onClick={onPullFromPool}>
              ⬇️
            </button>
          )}
          <button className="btn-small btn-danger" title="移除" onClick={onDelete}>
            🗑
          </button>
        </div>
      </div>

      {expanded && (
        <div className="char-item-edit">
          <div className="story-form-row">
            <label>头像</label>
            <div style={{ position: "relative" }}>
              <button
                className="protagonist-emoji-btn"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                {form.avatar_emoji}
              </button>
              {showEmojiPicker && (
                <div className="protagonist-emoji-picker">
                  {EMOJI_OPTIONS.map((e) => (
                    <button
                      key={e}
                      className={`protagonist-emoji-option ${e === form.avatar_emoji ? "selected" : ""}`}
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
          <div className="story-form-row">
            <label>名称</label>
            <input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="角色名称"
            />
          </div>
          <div className="story-form-row">
            <label>角色设定</label>
            <textarea
              value={form.setting}
              onChange={(e) => update("setting", e.target.value)}
              placeholder="描述角色的性格、背景、特长、行为习惯等…"
              rows={6}
            />
          </div>
          <div className="story-form-actions">
            <button className="btn" onClick={handleSave} disabled={saving}>
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
    <div className="char-copy-overlay" onClick={onClose}>
      <div className="char-add-modal" onClick={(e) => e.stopPropagation()}>
        <div className="char-add-modal-header">
          <h4>添加角色</h4>
          <button className="btn-ghost btn" onClick={onClose}>✕</button>
        </div>

        <div className="char-add-tabs">
          <button
            className={tab === "pool" ? "active" : ""}
            onClick={() => setTab("pool")}
          >
            📚 从角色池选择
          </button>
          <button
            className={tab === "new" ? "active" : ""}
            onClick={() => setTab("new")}
          >
            ✨ 手动创建
          </button>
        </div>

        {tab === "pool" && (
          <div className="char-pool-list">
            {protagonists.length === 0 && (
              <div className="characters-panel-hint">角色池为空，请先在「🎭 主角」中创建角色</div>
            )}
            {protagonists.map((p) => (
              <div
                key={p.id}
                className={`char-pool-option ${selectedPoolId === p.id ? "selected" : ""}`}
                onClick={() => setSelectedPoolId(p.id)}
              >
                <span className="protagonist-avatar-sm">{p.avatar_emoji}</span>
                <div className="char-pool-option-info">
                  <div className="char-pool-option-name">{p.name}</div>
                  <div className="char-pool-option-desc">
                    {p.setting ? (p.setting.length > 60 ? p.setting.slice(0, 60) + "…" : p.setting) : "暂无设定"}
                  </div>
                </div>
              </div>
            ))}
            <div className="char-add-modal-footer">
              <button className="btn" onClick={handleAddFromPool} disabled={!selectedPoolId || adding}>
                {adding ? "添加中…" : "加入对话"}
              </button>
            </div>
          </div>
        )}

        {tab === "new" && (
          <div className="char-new-form">
            <div className="story-form-row">
              <label>名称</label>
              <input
                value={newForm.name}
                onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="角色名称"
              />
            </div>
            <div className="story-form-row">
              <label>角色设定</label>
              <textarea
                value={newForm.setting}
                onChange={(e) => setNewForm((f) => ({ ...f, setting: e.target.value }))}
                placeholder="描述角色的性格、背景等…"
                rows={5}
              />
            </div>
            <div className="char-add-modal-footer">
              <button className="btn" onClick={handleAddNew} disabled={!newForm.name.trim() || adding}>
                {adding ? "添加中…" : "加入对话"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
