import { useEffect, useState } from "react";
import { useStoryStore } from "../stores/storyStore";
import { useUserProtagonistStore } from "../stores/userProtagonistStore";
import { usePresetStore } from "../stores/presetStore";

interface Props {
  onSelect: (storyId: string, openerIndex: number, presetId?: string) => void;
  onSkip: (presetId?: string) => void;
  onCancel: () => void;
  onManagePresets?: () => void;
}

export default function StorySelector({ onSelect, onSkip, onCancel, onManagePresets }: Props) {
  const { stories, loading, fetchStories } = useStoryStore();
  const { userProtagonists, fetchUserProtagonists } = useUserProtagonistStore();
  const { presets, loading: presetsLoading, fetchPresets } = usePresetStore();
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [selectedOpener, setSelectedOpener] = useState(0);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  useEffect(() => {
    fetchStories();
    fetchUserProtagonists();
    fetchPresets();
  }, [fetchStories, fetchUserProtagonists, fetchPresets]);

  // Auto-select default preset (or first) when presets load
  useEffect(() => {
    if (presets.length > 0 && !selectedPresetId) {
      const def = presets.find((p) => p.is_default) || presets[0];
      setSelectedPresetId(def.id);
    }
  }, [presets, selectedPresetId]);

  const noPresets = !presetsLoading && presets.length === 0;
  const selectedStory = stories.find((s) => s.id === selectedStoryId);
  const boundProtagonist = selectedStory?.protagonist_id
    ? userProtagonists.find((p) => p.id === selectedStory.protagonist_id)
    : null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center animate-[fadeIn_0.15s_ease-out]" onClick={onCancel}>
      <div className="w-[90vw] max-w-[960px] h-[80vh] bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-3 bg-[var(--bg-secondary)]">
          <h2 className="text-base font-semibold">选择故事开始对话</h2>
          <div className="flex-1" />
          {presets.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-[13px] text-[var(--text-secondary)]">预设：</label>
              <select
                className="bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] rounded-md px-2.5 py-1.5 text-[13px] outline-none"
                value={selectedPresetId || ""}
                onChange={(e) => setSelectedPresetId(e.target.value || null)}
              >
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.is_default ? " ★" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            className="bg-transparent border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] px-3 py-1.5 rounded-lg text-[13px] cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={() => onSkip(selectedPresetId || undefined)}
            disabled={noPresets}
          >
            跳过，自由对话
          </button>
          <button
            className="bg-transparent border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] px-2.5 py-1.5 rounded-lg text-[13px] cursor-pointer transition-colors"
            onClick={onCancel}
          >
            ✕
          </button>
        </div>

        {noPresets && (
          <div className="mx-4 mt-4 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
            <span className="text-amber-400 text-lg">⚠️</span>
            <span className="text-[13px] text-amber-300 flex-1">开始对话前必须先创建一个预设，用于定义 AI 的角色与行为风格。</span>
            {onManagePresets && (
              <button
                className="shrink-0 bg-amber-500 hover:bg-amber-400 text-white px-3 py-1.5 rounded-lg text-[13px] cursor-pointer border-none transition-colors"
                onClick={onManagePresets}
              >
                📝 创建预设
              </button>
            )}
          </div>
        )}
        {loading ? (
          <div className="text-sm text-[var(--text-secondary)] p-5">加载中…</div>
        ) : stories.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8 text-[var(--text-secondary)]">
            <div className="text-4xl opacity-30">📚</div>
            <p className="text-sm">还没有故事，先去故事管理中创建吧</p>
            <button
              className="bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2 rounded-lg text-[13px] cursor-pointer border-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => onSkip(selectedPresetId || undefined)}
              disabled={noPresets}
            >
              直接开始自由对话
            </button>
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 minimal-scrollbar">
              <div className="grid grid-cols-2 gap-3">
                {stories.map((s) => (
                  <div
                    key={s.id}
                    className={`relative overflow-hidden rounded-xl border-2 cursor-pointer transition-all hover:shadow-lg p-4${s.id === selectedStoryId ? " shadow-md" : " border-[var(--border)] bg-[var(--bg-surface)]"}`}
                    style={s.id === selectedStoryId ? { borderColor: s.color || "var(--accent)", background: "var(--bg-secondary)" } : {}}
                    onClick={() => {
                      setSelectedStoryId(s.id);
                      setSelectedOpener(0);
                    }}
                  >
                    <div
                      className="absolute top-0 left-0 right-0 h-1"
                      style={{ background: s.color || "var(--accent)" }}
                    />
                    <div className="text-[14px] font-semibold text-[var(--text-primary)] mb-1">{s.title}</div>
                    <div className="text-[12px] text-[var(--text-secondary)] line-clamp-2 mb-2">
                      {s.description || "暂无描述"}
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)]">
                      {s.openers.length} 条开场白
                      {s.protagonist_id && (() => { const bp = userProtagonists.find((p) => p.id === s.protagonist_id); return bp ? (
                        <> · {bp.avatar_url ? <img src={bp.avatar_url} alt="" className="w-4 h-4 rounded object-cover inline-block align-text-bottom" /> : bp.avatar_emoji} {bp.name}</>
                      ) : null; })()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedStory && (
              <div className="w-[300px] min-w-[300px] border-l border-[var(--border)] overflow-y-auto p-4 minimal-scrollbar flex flex-col gap-3">
                <h3 className="text-[15px] font-semibold" style={{ color: selectedStory.color || "var(--accent)" }}>
                  {selectedStory.title}
                </h3>
                {selectedStory.background && (
                  <div>
                    <span className="text-[11px] text-[var(--text-secondary)] mb-0.5 block">背景设定</span>
                    <p className="text-[13px] text-[var(--text-primary)] leading-relaxed">
                      {selectedStory.background.length > 200
                        ? selectedStory.background.slice(0, 200) + "…"
                        : selectedStory.background}
                    </p>
                  </div>
                )}

                {boundProtagonist && (
                  <div>
                    <span className="text-[11px] text-[var(--text-secondary)] mb-0.5 block">绑定主角</span>
                    <div className="flex items-center gap-2">
                      {boundProtagonist.avatar_url ? (
                        <img src={boundProtagonist.avatar_url} alt="" className="w-6 h-6 rounded object-cover" />
                      ) : (
                        <span className="text-base">{boundProtagonist.avatar_emoji}</span>
                      )}
                      <span className="text-[13px]">{boundProtagonist.name}</span>
                    </div>
                  </div>
                )}

                {selectedStory.openers.length > 0 ? (
                  <div>
                    <span className="text-[11px] text-[var(--text-secondary)] mb-1.5 block">选择开场白</span>
                    <div className="flex flex-col gap-2">
                      {selectedStory.openers.map((op, i) => (
                        <div
                          key={i}
                          className={`p-2.5 rounded-lg border cursor-pointer transition-colors${i === selectedOpener ? " border-indigo-500/50 bg-indigo-500/10" : " border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-tertiary)]"}`}
                          onClick={() => setSelectedOpener(i)}
                        >
                          <div className="text-[12px] font-medium text-[var(--text-primary)] mb-0.5">
                            {op.label || `开场白 ${i + 1}`}
                          </div>
                          <div className="text-[11px] text-[var(--text-secondary)] line-clamp-2">
                            {op.content.length > 80
                              ? op.content.slice(0, 80) + "…"
                              : op.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-[13px] text-[var(--text-secondary)]">
                    该故事暂无开场白
                  </div>
                )}

                <button
                  className="mt-auto bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2.5 rounded-lg text-[13px] font-medium cursor-pointer border-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={() => onSelect(selectedStory.id, selectedOpener, selectedPresetId || undefined)}
                  disabled={noPresets}
                >
                  🚀 开始对话
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
