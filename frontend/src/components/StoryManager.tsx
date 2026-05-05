import { useEffect, useState } from "react";
import { useStoryStore } from "../stores/storyStore";
import { useProtagonistStore } from "../stores/protagonistStore";
import { useUserProtagonistStore } from "../stores/userProtagonistStore";
import AIAssistModal from "./AIAssistModal";
import type { Story, StoryOpener, Protagonist, UserProtagonist } from "../types";

export default function StoryManager({ onClose }: { onClose: () => void }) {
  const { stories, loading, fetchStories, addStory, editStory, removeStory } =
    useStoryStore();
  const { protagonists, fetchProtagonists } = useProtagonistStore();
  const { userProtagonists, fetchUserProtagonists } = useUserProtagonistStore();
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchStories();
    fetchProtagonists();
    fetchUserProtagonists();
  }, [fetchStories, fetchProtagonists, fetchUserProtagonists]);

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
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center animate-[fadeIn_0.15s_ease-out]" onClick={onClose}>
      <div className="w-[calc(100vw-1rem)] max-w-[1000px] h-[calc(100dvh-1rem)] md:w-[90vw] md:h-[80vh] bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 md:px-5 md:py-4 border-b border-[var(--border)] flex flex-wrap items-center gap-3 bg-[var(--bg-secondary)]">
          <h2 className="text-base font-semibold">📚 故事管理</h2>
          <button className="bg-indigo-500 hover:bg-indigo-400 text-white px-3 py-1.5 rounded-lg text-[13px] cursor-pointer border-none transition-colors" onClick={handleAdd}>
            + 新建故事
          </button>
          <div className="hidden md:block flex-1" />
          <button className="bg-transparent border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] px-3 py-1.5 rounded-lg text-[13px] cursor-pointer transition-colors" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="flex flex-1 flex-col md:flex-row overflow-hidden min-h-0">
          {/* Left: story list */}
          <div className="w-full md:w-[300px] md:min-w-[300px] border-b md:border-b-0 md:border-r border-[var(--border)] overflow-y-auto p-3 minimal-scrollbar max-h-[38vh] md:max-h-none">
            {loading && <div className="text-sm text-[var(--text-secondary)] p-3">加载中…</div>}
            {!loading && stories.length === 0 && (
              <div className="text-sm text-[var(--text-secondary)] p-3">暂无故事，点击上方按钮创建</div>
            )}
            {stories.map((s) => (
              <div
                key={s.id}
                className={`p-3 rounded-lg border-l-[3px] bg-[var(--bg-surface)] mb-2 cursor-pointer relative transition-colors hover:bg-[var(--bg-tertiary)] group${s.id === editingId ? " ring-1 ring-[var(--accent)] bg-[var(--bg-tertiary)]" : ""}`}
                style={{ borderLeftColor: s.color || "var(--accent)" }}
                onClick={() => setEditingId(s.id)}
              >
                <div className="text-[13px] font-medium text-[var(--text-primary)] mb-1 truncate">{s.title || "未命名故事"}</div>
                <div className="text-[12px] text-[var(--text-secondary)] leading-relaxed line-clamp-2 mb-1">
                  {s.description || "暂无描述"}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)]">
                  {s.openers.length} 条开场白 · {s.preset_characters.length} 个预设角色{s.cast_ids?.length ? ` · ${s.cast_ids.length} 演员` : ""}
                </div>
                <button
                  className="absolute top-2 right-2 bg-transparent border-none cursor-pointer text-sm opacity-0 group-hover:opacity-100 transition-opacity p-0 leading-none"
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
          <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-5 minimal-scrollbar">
            {editingStory ? (
              <StoryForm
                key={editingStory.id}
                story={editingStory}
                onSave={(data) => editStory(editingStory.id, data)}
                protagonists={protagonists}
                userProtagonists={userProtagonists}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[180px] text-[var(--text-secondary)] gap-3 text-center px-4">
                <div className="text-4xl md:text-5xl opacity-30">📖</div>
                <div className="max-w-[16rem] leading-relaxed">选择或新建一个故事来编辑</div>
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
  preset_characters: string[];
  color: string;
  protagonist_id: string;
  cast_ids: string[];
}

function StoryForm({
  story,
  onSave,
  protagonists,
  userProtagonists,
}: {
  story: Story;
  onSave: (data: Partial<FormData>) => Promise<unknown>;
  protagonists: Protagonist[];
  userProtagonists: UserProtagonist[];
}) {
  const [form, setForm] = useState<FormData>({
    title: story.title,
    description: story.description,
    background: story.background,
    openers: story.openers.length > 0 ? story.openers : [],
    preset_characters: story.preset_characters,
    color: story.color || "#6366f1",
    protagonist_id: story.protagonist_id || "",
    cast_ids: story.cast_ids || [],
  });
  const [saving, setSaving] = useState(false);
  const [showPresetCharacterPicker, setShowPresetCharacterPicker] = useState(false);
  const [selectedPresetCharacterIds, setSelectedPresetCharacterIds] = useState<string[]>([]);
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

  const availablePresetCharacters = protagonists.filter(
    (p) => !form.preset_characters.includes(p.id)
  );

  const openPresetCharacterPicker = () => {
    setSelectedPresetCharacterIds([]);
    setShowPresetCharacterPicker(true);
  };

  const closePresetCharacterPicker = () => {
    setShowPresetCharacterPicker(false);
    setSelectedPresetCharacterIds([]);
  };

  const togglePresetCharacterSelection = (characterId: string) => {
    if (form.preset_characters.includes(characterId)) {
      return;
    }

    setSelectedPresetCharacterIds((current) =>
      current.includes(characterId)
        ? current.filter((id) => id !== characterId)
        : [...current, characterId]
    );
  };

  const addPresetCharacters = () => {
    if (selectedPresetCharacterIds.length === 0) {
      return;
    }

    update("preset_characters", [
      ...form.preset_characters,
      ...selectedPresetCharacterIds.filter((id) => !form.preset_characters.includes(id)),
    ]);
    closePresetCharacterPicker();
  };

  const removeCharacter = (id: string) =>
    update(
      "preset_characters",
      form.preset_characters.filter((characterId) => characterId !== id)
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-[var(--text-secondary)]">标题</label>
        <input
          className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm font-[inherit] outline-none focus:border-indigo-500/60 transition-colors w-full"
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          placeholder="故事标题"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-[var(--text-secondary)]">描述</label>
        <input
          className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm font-[inherit] outline-none focus:border-indigo-500/60 transition-colors w-full"
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="简短描述"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-[var(--text-secondary)]">主题色</label>
        <div className="flex gap-2 items-center">
          <input
            type="color"
            value={form.color}
            onChange={(e) => update("color", e.target.value)}
            style={{ width: 36, height: 28, padding: 0, border: "none", cursor: "pointer" }}
          />
          <span className="text-xs text-[var(--text-secondary)]">{form.color}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-[var(--text-secondary)]">绑定主角</label>
        <select
          className="bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] rounded-lg px-3 py-2 text-sm outline-none w-full"
          value={form.protagonist_id}
          onChange={(e) => update("protagonist_id", e.target.value)}
        >
          <option value="">不绑定（使用默认主角）</option>
          {userProtagonists.map((p) => (
            <option key={p.id} value={p.id}>
              {p.avatar_emoji} {p.name}{p.is_default ? " (默认)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-[13px] font-medium text-[var(--text-secondary)]">🎭 演员表 ({form.cast_ids.length})</label>
          <span className="text-[11px] text-[var(--text-secondary)]">开始对话时自动加入这些角色</span>
        </div>
        {protagonists.length === 0 && (
          <div className="text-xs text-[var(--text-secondary)] py-2">
            角色池为空，请先在角色池中创建角色
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {protagonists.map((p) => {
            const checked = form.cast_ids.includes(p.id);
            return (
              <label
                key={p.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-[13px]${checked ? " border-indigo-500/50 bg-indigo-500/10 text-[var(--text-primary)]" : " border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const newIds = checked
                      ? form.cast_ids.filter((id) => id !== p.id)
                      : [...form.cast_ids, p.id];
                    update("cast_ids", newIds);
                  }}
                />
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="w-5 h-5 rounded object-cover flex-shrink-0" />
                ) : (
                  <span>{p.avatar_emoji}</span>
                )}
                <span className="truncate">{p.name}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[13px] font-medium text-[var(--text-secondary)]">故事背景 (系统提示词)</label>
          <button
            className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20 px-2.5 py-1 rounded-md cursor-pointer text-xs transition-colors"
            onClick={() => setAiAssist({ fieldType: "background", original: form.background })}
          >
            ✨ AI 润色
          </button>
        </div>
        <textarea
          className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm font-[inherit] outline-none focus:border-indigo-500/60 transition-colors w-full resize-none"
          value={form.background}
          onChange={(e) => update("background", e.target.value)}
          placeholder="设定故事的世界观、基调和规则…"
          rows={6}
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-[13px] font-medium text-[var(--text-secondary)]">开场白 ({form.openers.length})</label>
          <button
            className="bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] px-2.5 py-1 rounded-md cursor-pointer text-xs hover:bg-[var(--bg-tertiary)] transition-colors"
            onClick={addOpener}
          >
            + 添加
          </button>
        </div>
        {form.openers.map((op, i) => (
          <div key={i} className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                className="bg-transparent border border-[var(--border)] rounded-md px-2.5 py-1.5 text-[var(--text-primary)] text-[13px] outline-none flex-1"
                value={op.label}
                onChange={(e) => updateOpener(i, "label", e.target.value)}
                placeholder={`开场白 ${i + 1} 标签`}
              />
              <button
                className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20 px-2.5 py-1 rounded-md cursor-pointer text-xs transition-colors"
                onClick={() => setAiAssist({ fieldType: "opener", original: op.content, openerIndex: i })}
              >
                ✨ AI
              </button>
            </div>
            <textarea
              className="bg-transparent border border-[var(--border)] rounded-md px-2.5 py-1.5 text-[var(--text-primary)] text-[13px] font-[inherit] outline-none resize-none w-full"
              value={op.content}
              onChange={(e) => updateOpener(i, "content", e.target.value)}
              placeholder="开场白内容…"
              rows={3}
            />
            <button
              className="self-end bg-red-500/10 border border-red-500/30 text-red-400 px-2.5 py-1 rounded-md cursor-pointer text-xs hover:bg-red-500/20 transition-colors"
              onClick={() => removeOpener(i)}
            >
              删除
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-[13px] font-medium text-[var(--text-secondary)]">预设角色 ({form.preset_characters.length})</label>
          <span className="text-[11px] text-[var(--text-secondary)]">从角色池引用，不在故事内复制角色内容</span>
        </div>
        {protagonists.length === 0 ? (
          <div className="text-xs text-[var(--text-secondary)] py-2">
            角色池为空，请先在角色池中创建角色
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex justify-end">
              <button
                className="bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] px-3 py-2 rounded-lg cursor-pointer text-sm hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50"
                onClick={openPresetCharacterPicker}
                disabled={availablePresetCharacters.length === 0}
              >
                + 添加角色
              </button>
            </div>

            {form.preset_characters.length === 0 ? (
              <div className="text-xs text-[var(--text-secondary)] py-2">
                暂无预设角色引用
              </div>
            ) : (
              form.preset_characters.map((characterId) => {
                const character = protagonists.find((p) => p.id === characterId);
                return (
                  <div key={characterId} className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-3 flex items-start gap-3">
                    <div className="text-lg leading-none pt-0.5 flex-shrink-0">
                      {character?.avatar_emoji || "🧩"}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                        {character?.name || "角色池条目不存在"}
                      </div>
                      <div className="text-[12px] text-[var(--text-secondary)] leading-relaxed break-words">
                        {character?.setting
                          ? character.setting.length > 120
                            ? `${character.setting.slice(0, 120)}…`
                            : character.setting
                          : "该引用仅保存角色池 ID，实际设定将在使用时读取最新角色数据。"}
                      </div>
                    </div>
                    <button
                      className="self-start bg-red-500/10 border border-red-500/30 text-red-400 px-2.5 py-1 rounded-md cursor-pointer text-xs hover:bg-red-500/20 transition-colors"
                      onClick={() => removeCharacter(characterId)}
                    >
                      删除
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      <div className="pt-2 flex justify-stretch md:justify-end">
        <button
          className="bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2 rounded-lg text-[13px] cursor-pointer border-none transition-colors disabled:opacity-50 w-full md:w-auto"
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

      {showPresetCharacterPicker && (
        <div
          className="fixed inset-0 bg-black/65 z-[200] flex items-center justify-center animate-[fadeIn_0.15s_ease-out] p-3"
          onClick={closePresetCharacterPicker}
        >
          <div
            className="w-[820px] max-w-[95vw] max-h-[82vh] bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-3 bg-[var(--bg-secondary)]">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[var(--text-primary)]">添加角色</div>
                <div className="text-xs text-[var(--text-secondary)] mt-1">
                  选择多个角色后批量加入当前故事的预设角色引用
                </div>
              </div>
              <button
                className="bg-transparent border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] px-3 py-1.5 rounded-lg text-[13px] cursor-pointer transition-colors"
                onClick={closePresetCharacterPicker}
              >
                ✕
              </button>
            </div>

            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between gap-3 bg-[var(--bg-primary)]">
              <div className="text-xs text-[var(--text-secondary)]">
                已选择 {selectedPresetCharacterIds.length} 个角色
              </div>
              <div className="text-xs text-[var(--text-secondary)]">
                可添加 {availablePresetCharacters.length} 个角色
              </div>
            </div>

            <div className="p-4 overflow-y-auto minimal-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {protagonists.map((p) => {
                  const alreadyAdded = form.preset_characters.includes(p.id);
                  const selected = selectedPresetCharacterIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className={`relative rounded-xl border p-3 transition-colors ${alreadyAdded ? "border-[var(--border)] bg-[var(--bg-secondary)] opacity-60 cursor-not-allowed" : selected ? "border-indigo-500/60 bg-indigo-500/10 cursor-pointer" : "border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-tertiary)] cursor-pointer"}`}
                    >
                      <input
                        type="checkbox"
                        className="absolute top-3 right-3"
                        checked={alreadyAdded || selected}
                        disabled={alreadyAdded}
                        onChange={() => togglePresetCharacterSelection(p.id)}
                      />
                      <div className="flex items-start gap-3 pr-7">
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center text-xl flex-shrink-0">
                            {p.avatar_emoji}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-[var(--text-primary)] truncate">{p.name}</div>
                          <div className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-3 break-words">
                            {p.setting || "暂无角色设定"}
                          </div>
                          <div className="text-[11px] mt-2 text-[var(--text-secondary)]">
                            {alreadyAdded ? "已加入当前故事" : selected ? "已选中，点击可取消" : "点击勾选后可批量添加"}
                          </div>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="px-4 py-3 border-t border-[var(--border)] flex items-center justify-end gap-2 bg-[var(--bg-secondary)]">
              <button
                className="bg-transparent border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] px-3 py-2 rounded-lg text-[13px] cursor-pointer transition-colors"
                onClick={closePresetCharacterPicker}
              >
                取消
              </button>
              <button
                className="bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2 rounded-lg text-[13px] cursor-pointer border-none transition-colors disabled:opacity-50"
                onClick={addPresetCharacters}
                disabled={selectedPresetCharacterIds.length === 0}
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
