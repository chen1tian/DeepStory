import { useEffect, useState } from "react";
import { useUserProtagonistStore } from "../stores/userProtagonistStore";
import { useSessionStore } from "../stores/sessionStore";
import { useUIStore } from "../stores/uiStore";
import AIAssistModal from "./AIAssistModal";
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
    <div className="story-manager-overlay" onClick={onClose}>
      <div className="story-manager" onClick={(e) => e.stopPropagation()}>
        <div className="story-manager-header">
          <h2>🎭 主角池</h2>
          <button className="btn" onClick={handleAdd}>
            + 新建主角
          </button>
          <div className="spacer" />
          <button className="btn-ghost btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="story-manager-body">
          {/* Left: protagonist list */}
          <div className="story-list-panel">
            {loading && <div className="story-loading">加载中…</div>}
            {!loading && userProtagonists.length === 0 && (
              <div className="story-loading">暂无主角，点击上方按钮创建</div>
            )}
            {userProtagonists.map((p) => (
              <div
                key={p.id}
                className={`story-card ${p.id === editingId ? "active" : ""}`}
                onClick={() => setEditingId(p.id)}
              >
                <div className="protagonist-card-header">
                  <span className="protagonist-avatar">{p.avatar_emoji}</span>
                  <span className="story-card-title">{p.name || "未命名主角"}</span>
                  {p.is_default && <span className="protagonist-default-badge">默认主角</span>}
                  {isCurrentSessionProtagonist(p.id) && (
                    <span className="protagonist-default-badge" style={{ background: "var(--accent, #6366f1)" }}>
                      当前对话
                    </span>
                  )}
                </div>
                <div className="story-card-desc">
                  {p.setting ? (p.setting.length > 60 ? p.setting.slice(0, 60) + "…" : p.setting) : "暂无设定"}
                </div>
                <div className="protagonist-card-btns" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn-small"
                    title="复制主角"
                    onClick={() => handleStartCopy(p)}
                  >
                    📋
                  </button>
                  {currentSessionId && (
                    <button
                      className="btn-small"
                      title="设为当前对话主角"
                      onClick={() => handleUseInSession(p)}
                      disabled={isCurrentSessionProtagonist(p.id)}
                    >
                      🎭 {isCurrentSessionProtagonist(p.id) ? "已使用" : "使用"}
                    </button>
                  )}
                  <button
                    className="story-card-delete"
                    onClick={() => handleDelete(p.id)}
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Right: edit form */}
          <div className="story-edit-panel">
            {editingProtagonist ? (
              <UserProtagonistForm
                key={editingProtagonist.id}
                protagonist={editingProtagonist}
                onSave={(data) => editUserProtagonist(editingProtagonist.id, data)}
              />
            ) : (
              <div className="empty-state">
                <div className="icon">🎭</div>
                <div>选择或新建一个主角来编辑</div>
                <div style={{ fontSize: "0.85em", color: "var(--text-muted)", marginTop: 8 }}>
                  主角是你的化身，在聊天时代入你的设定
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Copy dialog */}
      {copyTarget && (
        <div className="char-copy-overlay" onClick={() => setCopyTarget(null)}>
          <div className="char-copy-dialog" onClick={(e) => e.stopPropagation()}>
            <h4>复制主角</h4>
            <p>为复制的主角命名：</p>
            <input
              autoFocus
              value={copyName}
              onChange={(e) => setCopyName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirmCopy()}
              placeholder="主角名称"
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

/* ---- Inline form component ---- */

interface FormData {
  name: string;
  setting: string;
  avatar_emoji: string;
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
    <div className="story-form">
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
          placeholder="主角名称"
        />
      </div>

      <div className="story-form-row">
        <div className="story-form-label-row">
          <label>主角设定</label>
          <button
            className="btn-small btn-ai"
            onClick={() => setAiAssist({ fieldType: "protagonist", original: form.setting })}
          >
            ✨ AI 润色
          </button>
        </div>
        <textarea
          value={form.setting}
          onChange={(e) => update("setting", e.target.value)}
          placeholder="描述你的角色身份、性格、背景、口头禅等…聊天时会以此定义你的化身"
          rows={10}
        />
      </div>

      <div className="story-form-row">
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={form.is_default}
            onChange={(e) => update("is_default", e.target.checked)}
          />
          设为默认主角（新对话自动使用）
        </label>
      </div>

      <div className="story-form-actions">
        <button className="btn" onClick={handleSave} disabled={saving}>
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
