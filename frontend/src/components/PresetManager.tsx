import { useEffect, useState } from "react";
import { usePresetStore } from "../stores/presetStore";
import type { Preset } from "../types";

export default function PresetManager({ onClose }: { onClose: () => void }) {
  const { presets, loading, fetchPresets, addPreset, editPreset, removePreset } =
    usePresetStore();
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  const handleAdd = async () => {
    const p = await addPreset();
    setEditingId(p.id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此预设？")) return;
    await removePreset(id);
    if (editingId === id) setEditingId(null);
  };

  const editingPreset = presets.find((p) => p.id === editingId);

  return (
    <div className="story-manager-overlay" onClick={onClose}>
      <div className="story-manager" onClick={(e) => e.stopPropagation()}>
        <div className="story-manager-header">
          <h2>📝 预设管理</h2>
          <button className="btn" onClick={handleAdd}>
            + 新建预设
          </button>
          <div className="spacer" />
          <button className="btn-ghost btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="story-manager-body">
          {/* Left: preset list */}
          <div className="story-list-panel">
            {loading && <div className="story-loading">加载中…</div>}
            {!loading && presets.length === 0 && (
              <div className="story-loading">暂无预设，点击上方按钮创建</div>
            )}
            {presets.map((p) => (
              <div
                key={p.id}
                className={`story-card ${p.id === editingId ? "active" : ""}`}
                onClick={() => setEditingId(p.id)}
              >
                <div className="protagonist-card-header">
                  <span className="protagonist-avatar">📝</span>
                  <span className="story-card-title">{p.name || "未命名预设"}</span>
                  {p.is_default && <span className="protagonist-default-badge">默认</span>}
                </div>
                <div className="story-card-desc">
                  {p.description
                    ? p.description.length > 60
                      ? p.description.slice(0, 60) + "…"
                      : p.description
                    : p.content
                      ? p.content.length > 60
                        ? p.content.slice(0, 60) + "…"
                        : p.content
                      : "暂无内容"}
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
            {editingPreset ? (
              <PresetForm
                key={editingPreset.id}
                preset={editingPreset}
                onSave={(data) => editPreset(editingPreset.id, data)}
              />
            ) : (
              <div className="empty-state">
                <div className="icon">📝</div>
                <div>选择或新建一个预设来编辑</div>
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
  description: string;
  content: string;
  is_default: boolean;
}

function PresetForm({
  preset,
  onSave,
}: {
  preset: Preset;
  onSave: (data: Partial<FormData>) => Promise<unknown>;
}) {
  const [form, setForm] = useState<FormData>({
    name: preset.name,
    description: preset.description,
    content: preset.content,
    is_default: preset.is_default,
  });
  const [saving, setSaving] = useState(false);

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
        <label>名称</label>
        <input
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="预设名称"
        />
      </div>

      <div className="story-form-row">
        <label>描述</label>
        <input
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="简短描述此预设的用途"
        />
      </div>

      <div className="story-form-row">
        <label>系统提示词</label>
        <textarea
          value={form.content}
          onChange={(e) => update("content", e.target.value)}
          placeholder="输入系统提示词内容，定义 AI 的行为方式、角色定位和回复风格…"
          rows={16}
          style={{ fontFamily: "monospace", fontSize: 13 }}
        />
      </div>

      <div className="story-form-row">
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={form.is_default}
            onChange={(e) => update("is_default", e.target.checked)}
          />
          设为默认预设（自由对话时自动使用）
        </label>
      </div>

      <div className="story-form-actions">
        <button className="btn" onClick={handleSave} disabled={saving}>
          {saving ? "保存中…" : "💾 保存"}
        </button>
      </div>
    </div>
  );
}
