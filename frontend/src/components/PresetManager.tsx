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
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center animate-[fadeIn_0.15s_ease-out]" onClick={onClose}>
      <div className="w-[90vw] max-w-[1000px] h-[80vh] bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-3 bg-[var(--bg-secondary)]">
          <h2 className="text-base font-semibold">📝 预设管理</h2>
          <button className="bg-indigo-500 hover:bg-indigo-400 text-white px-3 py-1.5 rounded-lg text-[13px] cursor-pointer border-none transition-colors" onClick={handleAdd}>
            + 新建预设
          </button>
          <div className="flex-1" />
          <button className="bg-transparent border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] px-3 py-1.5 rounded-lg text-[13px] cursor-pointer transition-colors" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="flex flex-1 overflow-hidden">
          {/* Left: preset list */}
          <div className="w-[300px] min-w-[300px] border-r border-[var(--border)] overflow-y-auto p-3 minimal-scrollbar">
            {loading && <div className="text-sm text-[var(--text-secondary)] p-3">加载中…</div>}
            {!loading && presets.length === 0 && (
              <div className="text-sm text-[var(--text-secondary)] p-3">暂无预设，点击上方按钮创建</div>
            )}
            {presets.map((p) => (
              <div
                key={p.id}
                className={`p-3 rounded-lg border-l-[3px] border-l-[var(--accent)] bg-[var(--bg-surface)] mb-2 cursor-pointer relative transition-colors hover:bg-[var(--bg-tertiary)] group${p.id === editingId ? " ring-1 ring-[var(--accent)] bg-[var(--bg-tertiary)]" : ""}`}
                onClick={() => setEditingId(p.id)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">📝</span>
                  <span className="text-[13px] font-medium text-[var(--text-primary)] flex-1 truncate">{p.name || "未命名预设"}</span>
                  {p.is_default && <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-full font-medium">默认</span>}
                </div>
                <div className="text-[12px] text-[var(--text-secondary)] leading-relaxed line-clamp-2">
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
                  className="absolute top-2 right-2 bg-transparent border-none cursor-pointer text-sm opacity-0 group-hover:opacity-100 transition-opacity p-0 leading-none"
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
          <div className="flex-1 overflow-y-auto p-5 minimal-scrollbar">
            {editingPreset ? (
              <PresetForm
                key={editingPreset.id}
                preset={editingPreset}
                onSave={(data) => editPreset(editingPreset.id, data)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)] gap-3">
                <div className="text-5xl opacity-30">📝</div>
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-[var(--text-secondary)]">名称</label>
        <input
          className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm font-[inherit] outline-none focus:border-indigo-500/60 transition-colors w-full"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="预设名称"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-[var(--text-secondary)]">描述</label>
        <input
          className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm font-[inherit] outline-none focus:border-indigo-500/60 transition-colors w-full"
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="简短描述此预设的用途"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-[var(--text-secondary)]">系统提示词</label>
        <textarea
          className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm outline-none focus:border-indigo-500/60 transition-colors w-full resize-none"
          value={form.content}
          onChange={(e) => update("content", e.target.value)}
          placeholder="输入系统提示词内容，定义 AI 的行为方式、角色定位和回复风格…"
          rows={16}
          style={{ fontFamily: "monospace", fontSize: 13 }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-2 text-[13px] font-medium text-[var(--text-secondary)] cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_default}
            onChange={(e) => update("is_default", e.target.checked)}
          />
          设为默认预设（自由对话时自动使用）
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
    </div>
  );
}
