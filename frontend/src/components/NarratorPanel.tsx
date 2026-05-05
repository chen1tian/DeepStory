import { useState } from "react";
import { useNarratorStore } from "../stores/narratorStore";
import type {
  NarratorArc,
  StoryNode,
  NarrativeDirective,
  StoryNodeStatus,
  NarratorDirectiveType,
  CreateDirectiveRequest,
} from "../types";

interface Props {
  sessionId: string;
  onOpenEditor: (mode?: "edit" | "create") => void;
}

const STATUS_COLORS: Record<StoryNodeStatus, string> = {
  pending: "bg-gray-600 text-gray-300",
  active: "bg-blue-600 text-blue-100",
  completed: "bg-green-700 text-green-100",
  skipped: "bg-gray-700 text-gray-400 line-through",
};

const STATUS_LABELS: Record<StoryNodeStatus, string> = {
  pending: "待触发",
  active: "进行中",
  completed: "已完成",
  skipped: "已跳过",
};

const DIRECTIVE_TYPE_LABELS: Record<NarratorDirectiveType, string> = {
  introduce_character: "🧑 引入角色",
  introduce_threat: "⚔️ 引入威胁",
  atmosphere: "🌫️ 渲染氛围",
  advance_quest: "📜 推进任务",
  reveal_information: "🔍 揭示信息",
  create_dilemma: "⚖️ 制造困境",
  foreshadow: "🌙 埋下伏笔",
  pacing: "⏱️ 节奏控制",
  custom: "✏️ 自定义",
};

function TensionBar({ level }: { level: number }) {
  const pct = (level / 10) * 100;
  const color =
    level <= 3 ? "bg-blue-500" : level <= 6 ? "bg-yellow-500" : level <= 8 ? "bg-orange-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-[var(--text-secondary)] w-12">紧张度</span>
      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-mono w-6 text-right text-[var(--text-secondary)]">{level}</span>
    </div>
  );
}

function NodeCard({
  node,
  sessionId,
  onStatusChange,
}: {
  node: StoryNode;
  sessionId: string;
  onStatusChange: (nodeId: string, status: StoryNodeStatus) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const removeNode = useNarratorStore((s) => s.removeNode);

  return (
    <div
      className={`rounded-lg border transition-all ${
        node.status === "active"
          ? "border-blue-500/50 bg-blue-500/5"
          : node.status === "completed"
          ? "border-green-700/40 bg-green-900/10"
          : "border-white/8 bg-white/3"
      }`}
    >
      <div
        className="flex items-start gap-2 p-2.5 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_COLORS[node.status]}`}
            >
              {STATUS_LABELS[node.status]}
            </span>
            <span className="text-[12px] font-medium text-[var(--text-primary)] truncate">
              {node.title}
            </span>
          </div>
          {node.description && !expanded && (
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 truncate">{node.description}</p>
          )}
        </div>
        <span className="text-[var(--text-secondary)] text-xs">{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-2">
          {node.description && (
            <p className="text-[12px] text-[var(--text-secondary)]">{node.description}</p>
          )}
          {node.conditions && (
            <div className="bg-white/5 rounded p-2">
              <div className="text-[10px] text-[var(--text-secondary)] mb-1">触发条件</div>
              <p className="text-[11px] text-[var(--text-primary)]">{node.conditions}</p>
            </div>
          )}
          <div className="flex items-center gap-1 flex-wrap">
            {(["pending", "active", "completed", "skipped"] as StoryNodeStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => onStatusChange(node.id, s)}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                  node.status === s
                    ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]"
                    : "border-white/10 text-[var(--text-secondary)] hover:border-white/30"
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
            <button
              onClick={() => removeNode(sessionId, node.id)}
              className="ml-auto text-[10px] text-red-400/70 hover:text-red-400 transition-colors"
            >
              删除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DirectiveCard({
  directive,
  sessionId,
}: {
  directive: NarrativeDirective;
  sessionId: string;
}) {
  const removeDirective = useNarratorStore((s) => s.removeDirective);

  return (
    <div className="flex items-start gap-2 p-2 rounded-lg bg-white/5 border border-white/8 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[10px] text-[var(--accent)]">
            {DIRECTIVE_TYPE_LABELS[directive.type as NarratorDirectiveType] ?? directive.type}
          </span>
          {directive.persistent && (
            <span className="text-[10px] text-yellow-400/70">♾️</span>
          )}
          {directive.turns_remaining !== null && (
            <span className="text-[10px] text-[var(--text-secondary)]">剩{directive.turns_remaining}轮</span>
          )}
          <span className="text-[10px] text-[var(--text-secondary)] ml-auto">优先级 {directive.priority}</span>
        </div>
        <p className="text-[11px] text-[var(--text-primary)] leading-relaxed">{directive.content}</p>
      </div>
      <button
        onClick={() => removeDirective(sessionId, directive.id)}
        className="opacity-0 group-hover:opacity-100 text-red-400/70 hover:text-red-400 transition-all text-sm shrink-0"
        title="删除指令"
      >
        ×
      </button>
    </div>
  );
}

function ArchiveCard({ arc }: { arc: NarratorArc }) {
  const completedNodes = arc.nodes.filter((node) => node.status === "completed").length;
  const skippedNodes = arc.nodes.filter((node) => node.status === "skipped").length;
  const archivedLabel = arc.archived_at
    ? new Date(arc.archived_at).toLocaleString("zh-CN")
    : new Date(arc.updated_at).toLocaleString("zh-CN");

  return (
    <details className="rounded-lg border border-white/8 bg-white/3 overflow-hidden group">
      <summary className="list-none cursor-pointer p-3 flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] font-medium text-[var(--text-primary)] truncate">{arc.title}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[var(--text-secondary)]">
              已归档
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] mt-1 line-clamp-2">{arc.goal || "未填写故事目标"}</p>
          <div className="mt-2 flex items-center gap-2 flex-wrap text-[10px] text-[var(--text-secondary)]">
            <span>归档于 {archivedLabel}</span>
            <span>节点 {arc.nodes.length}</span>
            <span>完成 {completedNodes}</span>
            {skippedNodes > 0 && <span>跳过 {skippedNodes}</span>}
          </div>
        </div>
        <span className="text-[var(--text-secondary)] text-xs transition-transform group-open:rotate-180">▼</span>
      </summary>

      <div className="px-3 pb-3 border-t border-white/8 space-y-2">
        {arc.themes.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-2">
            {arc.themes.map((theme) => (
              <span key={theme} className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[var(--text-secondary)]">
                {theme}
              </span>
            ))}
          </div>
        )}

        {arc.nodes.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {arc.nodes
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((node) => (
                <div key={node.id} className="flex items-center gap-2 rounded-md bg-black/10 px-2 py-1.5">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_COLORS[node.status]}`}>
                    {STATUS_LABELS[node.status]}
                  </span>
                  <span className="text-[11px] text-[var(--text-primary)] truncate">{node.title}</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </details>
  );
}

function AddDirectiveForm({ sessionId }: { sessionId: string }) {
  const addDirective = useNarratorStore((s) => s.addDirective);
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [type, setType] = useState<NarratorDirectiveType>("custom");
  const [priority, setPriority] = useState(5);
  const [persistent, setPersistent] = useState(false);
  const [turns, setTurns] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    const data: CreateDirectiveRequest = {
      type,
      content: content.trim(),
      priority,
      persistent,
      turns_remaining: !persistent && turns ? parseInt(turns) : null,
    };
    await addDirective(sessionId, data);
    setContent("");
    setOpen(false);
    setSubmitting(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-dashed border-white/15 hover:border-white/30 rounded-lg py-1.5 transition-all"
      >
        + 手动添加指令
      </button>
    );
  }

  return (
    <div className="border border-[var(--accent)]/30 rounded-lg p-3 space-y-2 bg-[var(--accent)]/5">
      <textarea
        className="w-full bg-white/5 border border-white/10 rounded p-2 text-[12px] resize-none focus:outline-none focus:border-[var(--accent)]/50"
        rows={3}
        placeholder="指令内容（会直接注入到系统提示中）..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <select
          className="bg-white/5 border border-white/10 rounded px-2 py-1 text-[11px] flex-1 min-w-[120px] focus:outline-none"
          value={type}
          onChange={(e) => setType(e.target.value as NarratorDirectiveType)}
        >
          {Object.entries(DIRECTIVE_TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select
          className="bg-white/5 border border-white/10 rounded px-2 py-1 text-[11px] focus:outline-none"
          value={priority}
          onChange={(e) => setPriority(parseInt(e.target.value))}
        >
          {[1,2,3,4,5,6,7,8,9,10].map((n) => (
            <option key={n} value={n}>优先级 {n}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-4 text-[11px]">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={persistent}
            onChange={(e) => setPersistent(e.target.checked)}
            className="rounded"
          />
          <span className="text-[var(--text-secondary)]">持续生效</span>
        </label>
        {!persistent && (
          <label className="flex items-center gap-1.5">
            <span className="text-[var(--text-secondary)]">限制轮数</span>
            <input
              type="number"
              min="1"
              max="20"
              placeholder="不限"
              value={turns}
              onChange={(e) => setTurns(e.target.value)}
              className="w-14 bg-white/5 border border-white/10 rounded px-2 py-0.5 text-[11px] focus:outline-none"
            />
          </label>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={submitting || !content.trim()}
          className="flex-1 text-[12px] bg-[var(--accent)] text-white rounded py-1 disabled:opacity-50 transition-all"
        >
          {submitting ? "添加中..." : "添加指令"}
        </button>
        <button
          onClick={() => { setOpen(false); setContent(""); }}
          className="text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-3 transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  );
}

export default function NarratorPanel({ sessionId, onOpenEditor }: Props) {
  const arc = useNarratorStore((s) => s.arc);
  const archivedArcs = useNarratorStore((s) => s.archivedArcs);
  const lastUpdate = useNarratorStore((s) => s.lastUpdate);
  const toggleEnabled = useNarratorStore((s) => s.toggleEnabled);
  const updateNode = useNarratorStore((s) => s.updateNode);
  const [activeTab, setActiveTab] = useState<"nodes" | "directives" | "log" | "archive">("nodes");

  if (!arc) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="p-6 flex flex-col items-center justify-center gap-3 border-b border-[var(--border)]">
          <div className="text-3xl">🎬</div>
          <p className="text-[13px] text-[var(--text-secondary)] text-center">
            当前没有进行中的故事弧线。你可以开始新的弧线，已完成的弧线会保留在归档中。
          </p>
          <button
            onClick={() => onOpenEditor("create")}
            className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-[13px] font-medium transition-all hover:opacity-90"
          >
            🎬 开启新弧线
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">归档</span>
            <span className="text-[10px] text-[var(--text-secondary)]">{archivedArcs.length} 条</span>
          </div>
          {archivedArcs.length === 0 ? (
            <p className="text-[12px] text-[var(--text-secondary)] text-center py-4 border border-dashed border-white/10 rounded-lg">
              还没有归档的故事弧线。
            </p>
          ) : (
            archivedArcs.map((archivedArc) => <ArchiveCard key={archivedArc.id} arc={archivedArc} />)
          )}
        </div>
      </div>
    );
  }

  const handleStatusChange = async (nodeId: string, status: StoryNodeStatus) => {
    await updateNode(sessionId, nodeId, { status });
  };

  const activeDirectives = arc.active_directives.filter(
    (d) => d.turns_remaining === null || d.turns_remaining > 0
  );
  const isArcComplete = arc.nodes.length > 0 && arc.nodes.every((node) => node.status === "completed" || node.status === "skipped");

  return (
    <div className="flex flex-col h-full overflow-hidden text-[13px]">
      {/* Header */}
      <div className="p-3 border-b border-[var(--border)] shrink-0">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-semibold text-[var(--text-primary)] truncate">{arc.title}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  arc.enabled ? "bg-green-600/20 text-green-400" : "bg-gray-600/30 text-gray-400"
                }`}
              >
                {arc.enabled ? "运行中" : "已暂停"}
              </span>
            </div>
            {arc.goal && (
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 line-clamp-2">{arc.goal}</p>
            )}
          </div>
          <div className="flex gap-1 shrink-0 ml-2">
            <button
              onClick={() => onOpenEditor("create")}
              className="text-[11px] px-2 py-1 rounded border border-white/10 hover:border-white/25 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
              title="开始下一条弧线"
            >
              +
            </button>
            <button
              onClick={() => toggleEnabled(sessionId)}
              className="text-[11px] px-2 py-1 rounded border border-white/10 hover:border-white/25 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
              title={arc.enabled ? "暂停导演" : "启用导演"}
            >
              {arc.enabled ? "⏸" : "▶"}
            </button>
            <button
              onClick={() => onOpenEditor("edit")}
              className="text-[11px] px-2 py-1 rounded border border-white/10 hover:border-white/25 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
              title="编辑弧线"
            >
              ✏️
            </button>
          </div>
        </div>

        <TensionBar level={arc.tension_level} />

        {isArcComplete && (
          <div className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-2 flex items-center gap-2">
            <div className="text-[11px] text-emerald-200/90 flex-1">
              当前弧线的节点已经全部完成，可以开启下一条故事弧线，当前这条会自动归档。
            </div>
            <button
              onClick={() => onOpenEditor("create")}
              className="text-[11px] px-2 py-1 rounded bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30 transition-colors"
            >
              新建下一条
            </button>
          </div>
        )}

        {arc.themes.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {arc.themes.map((t) => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[var(--text-secondary)]">
                {t}
              </span>
            ))}
          </div>
        )}

        {lastUpdate && lastUpdate.assessment && (
          <div className="mt-2 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300/80 italic">
            "{lastUpdate.assessment}"
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] shrink-0">
        {(["nodes", "directives", "log", "archive"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1.5 text-[11px] font-medium transition-all ${
              activeTab === tab
                ? "border-b-2 border-[var(--accent)] text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {tab === "nodes"
              ? `节点 (${arc.nodes.length})`
              : tab === "directives"
              ? `指令 (${activeDirectives.length})`
              : tab === "log"
              ? "日志"
              : `归档 (${archivedArcs.length})`}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {activeTab === "nodes" && (
          <>
            {arc.nodes.length === 0 ? (
              <p className="text-[12px] text-[var(--text-secondary)] text-center py-4">
                还没有故事节点，在编辑器中添加或 AI 生成
              </p>
            ) : (
              arc.nodes.map((node) => (
                <NodeCard
                  key={node.id}
                  node={node}
                  sessionId={sessionId}
                  onStatusChange={handleStatusChange}
                />
              ))
            )}
            <button
              onClick={() => onOpenEditor("edit")}
              className="w-full text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-dashed border-white/15 hover:border-white/30 rounded-lg py-1.5 transition-all mt-1"
            >
              + 管理节点
            </button>
          </>
        )}

        {activeTab === "directives" && (
          <>
            {activeDirectives.length === 0 ? (
              <p className="text-[12px] text-[var(--text-secondary)] text-center py-4">
                当前没有活跃指令。在聊天过程中自动生成，或手动添加。
              </p>
            ) : (
              activeDirectives
                .sort((a, b) => b.priority - a.priority)
                .map((d) => (
                  <DirectiveCard key={d.id} directive={d} sessionId={sessionId} />
                ))
            )}
            <AddDirectiveForm sessionId={sessionId} />
          </>
        )}

        {activeTab === "log" && (
          <>
            {arc.evaluation_log.length === 0 ? (
              <p className="text-[12px] text-[var(--text-secondary)] text-center py-4">
                导演还未进行任何评估。聊天后将自动评估。
              </p>
            ) : (
              [...arc.evaluation_log].reverse().map((ev, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-white/3 border border-white/8 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)]">
                    <span>第 {ev.turn} 轮</span>
                    <span className={ev.tension_adjustment > 0 ? "text-red-400" : ev.tension_adjustment < 0 ? "text-blue-400" : ""}>
                      {ev.tension_adjustment > 0 ? `↑+${ev.tension_adjustment}` : ev.tension_adjustment < 0 ? `↓${ev.tension_adjustment}` : "→持平"}
                    </span>
                  </div>
                  {ev.summary && (
                    <p className="text-[12px] text-[var(--text-primary)]">{ev.summary}</p>
                  )}
                  {ev.node_changes.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {ev.node_changes.map((nc, j) => (
                        <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[var(--text-secondary)]">
                          {nc.title}: {nc.old_status} → {nc.new_status}
                        </span>
                      ))}
                    </div>
                  )}
                  {ev.new_directive_ids.length > 0 && (
                    <p className="text-[10px] text-[var(--accent)]/80">
                      生成 {ev.new_directive_ids.length} 条新指令
                    </p>
                  )}
                </div>
              ))
            )}
          </>
        )}

        {activeTab === "archive" && (
          <>
            {archivedArcs.length === 0 ? (
              <p className="text-[12px] text-[var(--text-secondary)] text-center py-4">
                还没有归档的故事弧线。
              </p>
            ) : (
              archivedArcs.map((archivedArc) => <ArchiveCard key={archivedArc.id} arc={archivedArc} />)
            )}
          </>
        )}
      </div>
    </div>
  );
}
