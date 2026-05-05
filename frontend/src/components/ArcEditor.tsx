import { useState, useEffect } from "react";
import { useNarratorStore } from "../stores/narratorStore";
import { useConnectionStore } from "../stores/connectionStore";
import type { StoryNode, CreateArcRequest, UpdateArcRequest, StoryNodeStatus } from "../types";
import { randomId } from "../utils/randomId";

interface Props {
  sessionId: string;
  mode?: "edit" | "create";
  onClose: () => void;
}

const STATUS_LABELS: Record<StoryNodeStatus, string> = {
  pending: "待触发",
  active: "进行中",
  completed: "已完成",
  skipped: "已跳过",
};

function NodeRow({
  node,
  onUpdate,
  onDelete,
}: {
  node: StoryNode;
  onUpdate: (updates: Partial<StoryNode>) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-white/10 rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-2 p-2.5 bg-white/3 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-[11px] text-[var(--text-secondary)] w-5 text-center font-mono">{node.order}</span>
        <input
          className="flex-1 bg-transparent text-[12px] font-medium focus:outline-none"
          value={node.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          placeholder="节点标题"
        />
        <select
          className="bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[10px] focus:outline-none"
          value={node.status}
          onChange={(e) => onUpdate({ status: e.target.value as StoryNodeStatus })}
          onClick={(e) => e.stopPropagation()}
        >
          {(Object.entries(STATUS_LABELS) as [StoryNodeStatus, string][]).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="text-red-400/60 hover:text-red-400 text-sm transition-colors ml-1"
        >
          ×
        </button>
        <span className="text-[var(--text-secondary)] text-xs">{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div className="p-3 space-y-2 border-t border-white/8">
          <div>
            <label className="text-[10px] text-[var(--text-secondary)] block mb-1">节点描述</label>
            <textarea
              className="w-full bg-white/5 border border-white/10 rounded p-2 text-[12px] resize-none focus:outline-none focus:border-[var(--accent)]/40"
              rows={2}
              value={node.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="这个节点应该发生什么，达到什么叙事目的..."
            />
          </div>
          <div>
            <label className="text-[10px] text-[var(--text-secondary)] block mb-1">触发条件（AI 评估用）</label>
            <textarea
              className="w-full bg-white/5 border border-white/10 rounded p-2 text-[12px] resize-none focus:outline-none focus:border-[var(--accent)]/40"
              rows={2}
              value={node.conditions}
              onChange={(e) => onUpdate({ conditions: e.target.value })}
              placeholder="例如：主角第一次遭遇主要反派后..."
            />
          </div>
          <div>
            <label className="text-[10px] text-[var(--text-secondary)] block mb-1">激活时的指令模板（每行一条）</label>
            <textarea
              className="w-full bg-white/5 border border-white/10 rounded p-2 text-[12px] resize-none focus:outline-none focus:border-[var(--accent)]/40"
              rows={2}
              value={node.directives_template.join("\n")}
              onChange={(e) => onUpdate({ directives_template: e.target.value.split("\n").filter(Boolean) })}
              placeholder="节点激活时注入的叙事指令..."
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function ArcEditor({ sessionId, mode = "edit", onClose }: Props) {
  const arc = useNarratorStore((s) => s.arc);
  const createArc = useNarratorStore((s) => s.createArc);
  const updateArc = useNarratorStore((s) => s.updateArc);
  const deleteArc = useNarratorStore((s) => s.deleteArc);
  const generateNodes = useNarratorStore((s) => s.generateNodes);
  const isGenerating = useNarratorStore((s) => s.isGenerating);
  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const editingArc = mode === "edit" ? arc : null;

  // Form state
  const [title, setTitle] = useState(editingArc?.title || "未命名弧线");
  const [goal, setGoal] = useState(editingArc?.goal || "");
  const [themes, setThemes] = useState((editingArc?.themes || []).join("、"));
  const [tone, setTone] = useState(editingArc?.tone || "");
  const [pacingNotes, setPacingNotes] = useState(editingArc?.pacing_notes || "");
  const [localNodes, setLocalNodes] = useState<StoryNode[]>(editingArc?.nodes || []);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // AI generate panel
  const [showGenerate, setShowGenerate] = useState(false);
  const [generateGoal, setGenerateGoal] = useState(goal);
  const [generateCount, setGenerateCount] = useState(5);
  const [generateContext, setGenerateContext] = useState("");

  useEffect(() => {
    if (editingArc) {
      setTitle(editingArc.title);
      setGoal(editingArc.goal);
      setThemes(editingArc.themes.join("、"));
      setTone(editingArc.tone);
      setPacingNotes(editingArc.pacing_notes);
      setLocalNodes(editingArc.nodes);
      return;
    }

    setTitle("未命名弧线");
    setGoal("");
    setThemes("");
    setTone("");
    setPacingNotes("");
    setLocalNodes([]);
  }, [editingArc, mode]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const themeList = themes.split(/[、,，]/).map((t) => t.trim()).filter(Boolean);
      if (editingArc) {
        const updates: UpdateArcRequest = { title, goal, themes: themeList, tone, pacing_notes: pacingNotes };
        await updateArc(sessionId, updates);
        // Sync node changes
        const addedNodes = localNodes.filter((n) => !editingArc.nodes.find((an) => an.id === n.id));
        const { addNode, updateNode, removeNode } = useNarratorStore.getState();
        for (const removed of editingArc.nodes.filter((an) => !localNodes.find((n) => n.id === an.id))) {
          await removeNode(sessionId, removed.id);
        }
        for (const node of localNodes) {
          const orig = editingArc.nodes.find((n) => n.id === node.id);
          if (addedNodes.includes(node)) {
            await addNode(sessionId, node);
          } else if (orig && JSON.stringify(orig) !== JSON.stringify(node)) {
            await updateNode(sessionId, node.id, node);
          }
        }
      } else {
        const themeList2 = themes.split(/[、,，]/).map((t) => t.trim()).filter(Boolean);
        const data: CreateArcRequest = {
          title,
          goal,
          themes: themeList2,
          tone,
          pacing_notes: pacingNotes,
          nodes: localNodes as unknown as CreateArcRequest["nodes"],
          connection_id: activeConnectionId,
        };
        await createArc(sessionId, data);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingArc) return;
    if (!confirm("确定要删除故事弧线吗？所有节点和指令都会被删除。")) return;
    setDeleting(true);
    await deleteArc(sessionId);
    setDeleting(false);
    onClose();
  };

  const handleAddNode = () => {
    const newNode: StoryNode = {
      id: randomId(),
      title: `节点 ${localNodes.length + 1}`,
      description: "",
      conditions: "",
      status: "pending",
      order: localNodes.length + 1,
      directives_template: [],
      created_at: new Date().toISOString(),
    };
    setLocalNodes([...localNodes, newNode]);
  };

  const handleGenerateNodes = async () => {
    if (!generateGoal.trim()) return;
    const generated = await generateNodes(sessionId, {
      goal: generateGoal,
      count: generateCount,
      context: generateContext,
      connection_id: activeConnectionId,
    });
    // Add generated nodes to local state (don't save to backend yet)
    setLocalNodes((prev) => {
      const maxOrder = prev.length > 0 ? Math.max(...prev.map((n) => n.order)) : 0;
      return [
        ...prev,
        ...generated.map((n, i) => ({ ...n, order: maxOrder + n.order + i })),
      ];
    });
    setShowGenerate(false);
  };

  const updateLocalNode = (id: string, updates: Partial<StoryNode>) => {
    setLocalNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...updates } : n)));
  };

  const removeLocalNode = (id: string) => {
    setLocalNodes((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl w-full max-w-2xl max-h-[90dvh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎬</span>
            <span className="font-semibold text-[var(--text-primary)]">
              {editingArc ? "编辑故事弧线" : "创建故事弧线"}
            </span>
          </div>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xl p-1 transition-colors">×</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!editingArc && arc && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200/90">
              创建新弧线后，当前弧线会自动归档到历史记录中。
            </div>
          )}

          {/* Basic info */}
          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-[var(--text-secondary)] block mb-1">弧线名称</label>
              <input
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[var(--accent)]/50"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="给这条故事弧线起个名字"
              />
            </div>
            <div>
              <label className="text-[11px] text-[var(--text-secondary)] block mb-1">故事目标 <span className="text-[var(--accent)]">*</span></label>
              <textarea
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[13px] resize-none focus:outline-none focus:border-[var(--accent)]/50"
                rows={3}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="描述这段故事弧线想要达到的长远目标，例如：主角从一个懵懂少年成长为守护家园的英雄，经历背叛、绝望和重生..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-[var(--text-secondary)] block mb-1">主题（用顿号分隔）</label>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[var(--accent)]/50"
                  value={themes}
                  onChange={(e) => setThemes(e.target.value)}
                  placeholder="成长、背叛、救赎"
                />
              </div>
              <div>
                <label className="text-[11px] text-[var(--text-secondary)] block mb-1">基调</label>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[var(--accent)]/50"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  placeholder="悬疑紧张、温情治愈..."
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-[var(--text-secondary)] block mb-1">节奏指导（可选）</label>
              <input
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[var(--accent)]/50"
                value={pacingNotes}
                onChange={(e) => setPacingNotes(e.target.value)}
                placeholder="例如：每5轮设置一个小高潮，避免连续超过3轮的平静对话..."
              />
            </div>
          </div>

          {/* Nodes section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-medium text-[var(--text-primary)]">故事节点 ({localNodes.length})</span>
              <div className="flex gap-2">
                <button
                  onClick={() => { setGenerateGoal(goal); setShowGenerate(!showGenerate); }}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30 transition-all"
                >
                  ✨ AI 生成
                </button>
                <button
                  onClick={handleAddNode}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 border border-white/15 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-white/30 transition-all"
                >
                  + 手动添加
                </button>
              </div>
            </div>

            {showGenerate && (
              <div className="mb-3 p-3 rounded-lg border border-purple-500/25 bg-purple-600/5 space-y-2">
                <p className="text-[11px] text-purple-300">AI 将根据目标自动生成故事节点序列</p>
                <textarea
                  className="w-full bg-white/5 border border-white/10 rounded p-2 text-[12px] resize-none focus:outline-none"
                  rows={2}
                  value={generateGoal}
                  onChange={(e) => setGenerateGoal(e.target.value)}
                  placeholder="要生成节点的故事目标..."
                />
                <div className="flex items-center gap-3">
                  <label className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1.5">
                    数量
                    <input
                      type="number"
                      min={2}
                      max={10}
                      value={generateCount}
                      onChange={(e) => setGenerateCount(parseInt(e.target.value))}
                      className="w-12 bg-white/5 border border-white/10 rounded px-2 py-0.5 text-center focus:outline-none"
                    />
                  </label>
                  <input
                    className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-[11px] focus:outline-none"
                    value={generateContext}
                    onChange={(e) => setGenerateContext(e.target.value)}
                    placeholder="可选：当前故事背景（帮助 AI 理解上下文）"
                  />
                  <button
                    onClick={handleGenerateNodes}
                    disabled={isGenerating || !generateGoal.trim()}
                    className="text-[11px] px-3 py-1 rounded-lg bg-purple-600 text-white disabled:opacity-50 hover:bg-purple-500 transition-all"
                  >
                    {isGenerating ? "生成中..." : "生成"}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {localNodes.length === 0 ? (
                <p className="text-[12px] text-[var(--text-secondary)] text-center py-4 border border-dashed border-white/10 rounded-lg">
                  还没有故事节点，使用 AI 生成或手动添加
                </p>
              ) : (
                localNodes
                  .sort((a, b) => a.order - b.order)
                  .map((node) => (
                    <NodeRow
                      key={node.id}
                      node={node}
                      onUpdate={(updates) => updateLocalNode(node.id, updates)}
                      onDelete={() => removeLocalNode(node.id)}
                    />
                  ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border)] flex items-center gap-3 shrink-0">
          {editingArc && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-[12px] text-red-400/70 hover:text-red-400 transition-colors disabled:opacity-50"
            >
              {deleting ? "删除中..." : "删除弧线"}
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !goal.trim()}
            className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-[13px] font-medium disabled:opacity-50 hover:opacity-90 transition-all"
          >
            {saving ? "保存中..." : editingArc ? "保存更改" : "创建并切换"}
          </button>
        </div>
      </div>
    </div>
  );
}
