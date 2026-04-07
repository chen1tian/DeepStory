import { useEffect, useState } from "react";
import { useStoryStore } from "../stores/storyStore";

interface Props {
  onSelect: (storyId: string, openerIndex: number) => void;
  onSkip: () => void;
  onCancel: () => void;
}

export default function StorySelector({ onSelect, onSkip, onCancel }: Props) {
  const { stories, loading, fetchStories } = useStoryStore();
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [selectedOpener, setSelectedOpener] = useState(0);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  const selectedStory = stories.find((s) => s.id === selectedStoryId);

  return (
    <div className="story-selector-overlay" onClick={onCancel}>
      <div className="story-selector" onClick={(e) => e.stopPropagation()}>
        <div className="story-selector-header">
          <h2>选择故事开始对话</h2>
          <div className="spacer" />
          <button className="btn-ghost btn" onClick={onSkip}>
            跳过，自由对话
          </button>
          <button className="btn-ghost btn" onClick={onCancel} style={{ padding: "6px 10px" }}>
            ✕
          </button>
        </div>

        {loading ? (
          <div className="story-loading">加载中…</div>
        ) : stories.length === 0 ? (
          <div className="story-selector-empty">
            <div className="icon" style={{ fontSize: 36, opacity: 0.3 }}>📚</div>
            <p>还没有故事，先去故事管理中创建吧</p>
            <button className="btn" onClick={onSkip}>
              直接开始自由对话
            </button>
          </div>
        ) : (
          <div className="story-selector-body">
            <div className="story-selector-grid">
              {stories.map((s) => (
                <div
                  key={s.id}
                  className={`story-select-card ${s.id === selectedStoryId ? "selected" : ""}`}
                  onClick={() => {
                    setSelectedStoryId(s.id);
                    setSelectedOpener(0);
                  }}
                  style={{ borderColor: s.id === selectedStoryId ? (s.color || "var(--accent)") : undefined }}
                >
                  <div
                    className="story-select-card-accent"
                    style={{ background: s.color || "var(--accent)" }}
                  />
                  <div className="story-select-card-title">{s.title}</div>
                  <div className="story-select-card-desc">
                    {s.description || "暂无描述"}
                  </div>
                  <div className="story-select-card-meta">
                    {s.openers.length} 条开场白
                  </div>
                </div>
              ))}
            </div>

            {selectedStory && (
              <div className="story-selector-detail">
                <h3 style={{ color: selectedStory.color || "var(--accent)" }}>
                  {selectedStory.title}
                </h3>
                {selectedStory.background && (
                  <div className="story-selector-bg">
                    <span className="label">背景设定</span>
                    <p>{selectedStory.background.length > 200
                      ? selectedStory.background.slice(0, 200) + "…"
                      : selectedStory.background}</p>
                  </div>
                )}

                {selectedStory.openers.length > 0 ? (
                  <>
                    <div className="label" style={{ marginTop: 12 }}>选择开场白</div>
                    <div className="story-opener-list">
                      {selectedStory.openers.map((op, i) => (
                        <div
                          key={i}
                          className={`story-opener-option ${i === selectedOpener ? "selected" : ""}`}
                          onClick={() => setSelectedOpener(i)}
                        >
                          <div className="opener-option-label">
                            {op.label || `开场白 ${i + 1}`}
                          </div>
                          <div className="opener-option-content">
                            {op.content.length > 80
                              ? op.content.slice(0, 80) + "…"
                              : op.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 12 }}>
                    该故事暂无开场白
                  </div>
                )}

                <button
                  className="btn story-start-btn"
                  onClick={() => onSelect(selectedStory.id, selectedOpener)}
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
