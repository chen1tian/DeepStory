import { useEffect, useState } from "react";
import { useStoryStore } from "../stores/storyStore";
import { useProtagonistStore } from "../stores/protagonistStore";
import AIAssistModal from "./AIAssistModal";
import type { Story, StoryOpener, CharacterInfo, Protagonist } from "../types";

export default function StoryManager({ onClose }: { onClose: () => void }) {
  const { stories, loading, fetchStories, addStory, editStory, removeStory } =
    useStoryStore();
  const { protagonists, fetchProtagonists } = useProtagonistStore();
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchStories();
    fetchProtagonists();
  }, [fetchStories, fetchProtagonists]);

  const handleAdd = async () => {
    const story = await addStory();
    setEditingId(story.id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此故事？")) return;
    await removeStory(id);
    if (editingId === id) setEditingId(null);
  };

  const editingStory = stories.find((s) => s.id === editingId);

  return (
    <div className="story-manager-overlay" onClick={onClose}>
      <div className="story-manager" onClick={(e) => e.stopPropagation()}>
        <div className="story-manager-header">
          <h2>📚 故事管理</h2>
          <button className="btn" onClick={handleAdd}>
            + 新建故事
          </button>
          <div className="spacer" />
          <button className="btn-ghost btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="story-manager-body">
          {/* Left: story list */}
          <div className="story-list-panel">
            {loading && <div className="story-loading">加载中…</div>}
            {!loading && stories.length === 0 && (
              <div className="story-loading">暂无故事，点击上方按钮创建</div>
            )}
            {stories.map((s) => (
              <div
                key={s.id}
                className={`story-card ${s.id === editingId ? "active" : ""}`}
                onClick={() => setEditingId(s.id)}
                style={{ borderLeftColor: s.color || "var(--accent)" }}
              >
                <div className="story-card-title">{s.title || "未命名故事"}</div>
                <div className="story-card-desc">
                  {s.description || "暂无描述"}
                </div>
                <div className="story-card-meta">
                  {s.openers.length} 条开场白 · {s.preset_characters.length} 个角色
                </div>
                <button
                  className="story-card-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(s.id);
                  }}
                >
                  🗑
                </button>
              </div>
            ))}
          </div>

          {/* Right: edit form */}
          <div className="story-edit-panel">
            {editingStory ? (
              <StoryForm
                key={editingStory.id}
                story={editingStory}
                onSave={(data) => editStory(editingStory.id, data)}
                protagonists={protagonists}
              />
            ) : (
              <div className="empty-state">
                <div className="icon">📖</div>
                <div>选择或新建一个故事来编辑</div>
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
  title: string;
  description: string;
  background: string;
  openers: StoryOpener[];
  preset_characters: CharacterInfo[];
  color: string;
  protagonist_id: string;
}

function StoryForm({
  story,
  onSave,
  protagonists,
}: {
  story: Story;
  onSave: (data: Partial<FormData>) => Promise<unknown>;
  protagonists: Protagonist[];
}) {
  const [form, setForm] = useState<FormData>({
    title: story.title,
    description: story.description,
    background: story.background,
    openers: story.openers.length > 0 ? story.openers : [],
    preset_characters: story.preset_characters,
    color: story.color || "#6366f1",
    protagonist_id: story.protagonist_id || "",
  });
  const [saving, setSaving] = useState(false);
  const [aiAssist, setAiAssist] = useState<{
    fieldType: string;
    original: string;
    openerIndex?: number;
  } | null>(null);

  const handleAiResult = (text: string) => {
    if (!aiAssist) return;
    if (aiAssist.fieldType === "background") {
      update("background", text);
    } else if (aiAssist.fieldType === "opener" && aiAssist.openerIndex != null) {
      updateOpener(aiAssist.openerIndex, "content", text);
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

  // Opener helpers
  const addOpener = () =>
    update("openers", [...form.openers, { label: "", content: "" }]);

  const removeOpener = (i: number) =>
    update(
      "openers",
      form.openers.filter((_, idx) => idx !== i)
    );

  const updateOpener = (i: number, field: keyof StoryOpener, val: string) =>
    update(
      "openers",
      form.openers.map((o, idx) =>
        idx === i ? { ...o, [field]: val } : o
      )
    );

  // Character helpers
  const addCharacter = () =>
    update("preset_characters", [
      ...form.preset_characters,
      { name: "", description: "", status: "" },
    ]);

  const removeCharacter = (i: number) =>
    update(
      "preset_characters",
      form.preset_characters.filter((_, idx) => idx !== i)
    );

  const updateCharacter = (i: number, field: keyof CharacterInfo, val: string) =>
    update(
      "preset_characters",
      form.preset_characters.map((c, idx) =>
        idx === i ? { ...c, [field]: val } : c
      )
    );

  return (
    <div className="story-form">
      <div className="story-form-row">
        <label>标题</label>
        <input
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          placeholder="故事标题"
        />
      </div>

      <div className="story-form-row">
        <label>描述</label>
        <input
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="简短描述"
        />
      </div>

      <div className="story-form-row">
        <label>主题色</label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="color"
            value={form.color}
            onChange={(e) => update("color", e.target.value)}
            style={{ width: 36, height: 28, padding: 0, border: "none", cursor: "pointer" }}
          />
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{form.color}</span>
        </div>
      </div>

      <div className="story-form-row">
        <label>绑定主角</label>
        <select
          value={form.protagonist_id}
          onChange={(e) => update("protagonist_id", e.target.value)}
          className="protagonist-select"
        >
          <option value="">不绑定（使用默认主角）</option>
          {protagonists.map((p) => (
            <option key={p.id} value={p.id}>
              {p.avatar_emoji} {p.name}{p.is_default ? " (默认)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="story-form-row">
        <div className="story-form-label-row">
          <label>故事背景 (系统提示词)</label>
          <button
            className="btn-small btn-ai"
            onClick={() => setAiAssist({ fieldType: "background", original: form.background })}
          >
            ✨ AI 润色
          </button>
        </div>
        <textarea
          value={form.background}
          onChange={(e) => update("background", e.target.value)}
          placeholder="设定故事的世界观、基调和规则…"
          rows={6}
        />
      </div>

      <div className="story-form-section">
        <div className="story-form-section-header">
          <label>开场白 ({form.openers.length})</label>
          <button className="btn-small" onClick={addOpener}>
            + 添加
          </button>
        </div>
        {form.openers.map((op, i) => (
          <div key={i} className="story-opener-item">
            <div className="story-form-label-row">
              <input
                value={op.label}
                onChange={(e) => updateOpener(i, "label", e.target.value)}
                placeholder={`开场白 ${i + 1} 标签`}
                className="opener-label-input"
                style={{ flex: 1 }}
              />
              <button
                className="btn-small btn-ai"
                onClick={() => setAiAssist({ fieldType: "opener", original: op.content, openerIndex: i })}
              >
                ✨ AI
              </button>
            </div>
            <textarea
              value={op.content}
              onChange={(e) => updateOpener(i, "content", e.target.value)}
              placeholder="开场白内容…"
              rows={3}
            />
            <button className="btn-small btn-danger" onClick={() => removeOpener(i)}>
              删除
            </button>
          </div>
        ))}
      </div>

      <div className="story-form-section">
        <div className="story-form-section-header">
          <label>预设角色 ({form.preset_characters.length})</label>
          <button className="btn-small" onClick={addCharacter}>
            + 添加
          </button>
        </div>
        {form.preset_characters.map((ch, i) => (
          <div key={i} className="story-character-item">
            <input
              value={ch.name}
              onChange={(e) => updateCharacter(i, "name", e.target.value)}
              placeholder="角色名称"
            />
            <input
              value={ch.description}
              onChange={(e) => updateCharacter(i, "description", e.target.value)}
              placeholder="角色描述"
            />
            <input
              value={ch.status}
              onChange={(e) => updateCharacter(i, "status", e.target.value)}
              placeholder="初始状态"
            />
            <button className="btn-small btn-danger" onClick={() => removeCharacter(i)}>
              删除
            </button>
          </div>
        ))}
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
