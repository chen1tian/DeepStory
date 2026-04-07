import { useEffect, useState } from "react";
import { useProtagonistStore } from "../stores/protagonistStore";
import AIAssistModal from "./AIAssistModal";
import type { Protagonist } from "../types";

const EMOJI_OPTIONS = ["🧑", "👩", "👨", "🧙", "🦸", "🧝", "🧛", "🥷", "👸", "🤴", "🧚", "🦹", "👼", "🐉", "🐺", "🦊"];

export default function ProtagonistManager({ onClose }: { onClose: () => void }) {
  const { protagonists, loading, fetchProtagonists, addProtagonist, editProtagonist, removeProtagonist } =
    useProtagonistStore();
  const [editingId, setEditingId] = useState<string | null>(null);

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

  const editingProtagonist = protagonists.find((p) => p.id === editingId);

  return (
    <div className="story-manager-overlay" onClick={onClose}>
      <div className="story-manager" onClick={(e) => e.stopPropagation()}>
        <div className="story-manager-header">
          <h2>🎭 主角管理</h2>
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
            {!loading && protagonists.length === 0 && (
              <div className="story-loading">暂无主角，点击上方按钮创建</div>
            )}
            {protagonists.map((p) => (
              <div
                key={p.id}
                className={`story-card ${p.id === editingId ? "active" : ""}`}
                onClick={() => setEditingId(p.id)}
              >
                <div className="protagonist-card-header">
                  <span className="protagonist-avatar">{p.avatar_emoji}</span>
                  <span className="story-card-title">{p.name || "未命名主角"}</span>
                  {p.is_default && <span className="protagonist-default-badge">默认</span>}
                </div>
                <div className="story-card-desc">
                  {p.setting ? (p.setting.length > 60 ? p.setting.slice(0, 60) + "…" : p.setting) : "暂无设定"}
                </div>
                <button
                  className="story-card-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(p.id);
                  }}
                >
                  🗑
                </button>
              </div>
            ))}
          </div>

          {/* Right: edit form */}
          <div className="story-edit-panel">
            {editingProtagonist ? (
              <ProtagonistForm
                key={editingProtagonist.id}
                protagonist={editingProtagonist}
                onSave={(data) => editProtagonist(editingProtagonist.id, data)}
              />
            ) : (
              <div className="empty-state">
                <div className="icon">🎭</div>
                <div>选择或新建一个主角来编辑</div>
              </div>
            )}
          </div>
        </div>
      </div>
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
          <label>角色设定</label>
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
          placeholder="描述主角的性格、背景、特长、行为习惯等…"
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
