import type { RelationshipMetricConfig } from "../types";

export default function RelationshipMetricsEditor({
  metrics,
  onChange,
}: {
  metrics: RelationshipMetricConfig[];
  onChange: (metrics: RelationshipMetricConfig[]) => void;
}) {
  const updateMetric = (index: number, patch: Partial<RelationshipMetricConfig>) => {
    onChange(metrics.map((metric, i) => (i === index ? { ...metric, ...patch } : metric)));
  };

  const toInt = (value: string, fallback: number) => {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const addMetric = () => {
    onChange([
      ...metrics,
      {
        name: "好感度",
        description: "角色对玩家的亲近、信任和愿意配合的程度",
        min_value: 0,
        max_value: 100,
        initial_value: 0,
        stages: [
          { min: 0, max: 20, label: "普通朋友", description: "经常见面但是不太熟悉" },
          { min: 21, max: 40, label: "好朋友", description: "会一起吃饭、聊天或玩游戏" },
        ],
      },
    ]);
  };

  const addStage = (metricIndex: number) => {
    const metric = metrics[metricIndex];
    updateMetric(metricIndex, { stages: [...metric.stages, { min: 0, max: 100, label: "新阶段", description: "" }] });
  };

  const updateStage = (
    metricIndex: number,
    stageIndex: number,
    patch: Partial<RelationshipMetricConfig["stages"][number]>,
  ) => {
    const metric = metrics[metricIndex];
    updateMetric(metricIndex, {
      stages: metric.stages.map((stage, i) => (i === stageIndex ? { ...stage, ...patch } : stage)),
    });
  };

  return (
    <div className="flex flex-col gap-2 border border-[var(--border)] rounded-lg p-3 bg-[var(--bg-secondary)]">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[11px] text-[var(--text-secondary)]">关系字段</label>
        <button className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 px-2 py-1 rounded-md cursor-pointer text-xs transition-colors" onClick={addMetric} type="button">
          + 添加字段
        </button>
      </div>
      {metrics.length === 0 && <div className="text-[12px] text-[var(--text-secondary)]">暂无关系字段。可以添加好感度、信任度、恐惧值等阶段性关系。</div>}
      {metrics.map((metric, metricIndex) => (
        <div key={metricIndex} className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg p-2.5 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <input className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md px-2 py-1.5 text-xs outline-none focus:border-indigo-500/60" value={metric.name} onChange={(e) => updateMetric(metricIndex, { name: e.target.value })} placeholder="字段名，如好感度" />
            <div className="grid grid-cols-3 gap-1.5">
              <input type="number" className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md px-2 py-1.5 text-xs outline-none focus:border-indigo-500/60" value={metric.min_value} onChange={(e) => updateMetric(metricIndex, { min_value: toInt(e.target.value, metric.min_value) })} title="最小值" />
              <input type="number" className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md px-2 py-1.5 text-xs outline-none focus:border-indigo-500/60" value={metric.max_value} onChange={(e) => updateMetric(metricIndex, { max_value: toInt(e.target.value, metric.max_value) })} title="最大值" />
              <input type="number" className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md px-2 py-1.5 text-xs outline-none focus:border-indigo-500/60" value={metric.initial_value} onChange={(e) => updateMetric(metricIndex, { initial_value: toInt(e.target.value, metric.initial_value) })} title="初始值" />
            </div>
          </div>
          <textarea className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md px-2 py-1.5 text-xs outline-none focus:border-indigo-500/60 resize-y" value={metric.description} onChange={(e) => updateMetric(metricIndex, { description: e.target.value })} placeholder="字段含义" rows={2} />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[var(--text-secondary)]">阶段</span>
            <div className="flex gap-1.5">
              <button className="bg-[var(--bg-surface)] border border-[var(--border)] px-2 py-1 rounded text-xs cursor-pointer" type="button" onClick={() => addStage(metricIndex)}>+ 阶段</button>
              <button className="bg-transparent border border-red-500/40 text-red-400 px-2 py-1 rounded text-xs cursor-pointer" type="button" onClick={() => onChange(metrics.filter((_, i) => i !== metricIndex))}>删除字段</button>
            </div>
          </div>
          {metric.stages.map((stage, stageIndex) => (
            <div key={stageIndex} className="grid grid-cols-[56px_56px_1fr_auto] gap-1.5 items-start">
              <input type="number" className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md px-2 py-1.5 text-xs outline-none" value={stage.min} onChange={(e) => updateStage(metricIndex, stageIndex, { min: toInt(e.target.value, stage.min) })} />
              <input type="number" className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md px-2 py-1.5 text-xs outline-none" value={stage.max} onChange={(e) => updateStage(metricIndex, stageIndex, { max: toInt(e.target.value, stage.max) })} />
              <div className="grid grid-cols-1 gap-1.5">
                <input className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md px-2 py-1.5 text-xs outline-none" value={stage.label} onChange={(e) => updateStage(metricIndex, stageIndex, { label: e.target.value })} placeholder="阶段名" />
                <input className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-md px-2 py-1.5 text-xs outline-none" value={stage.description} onChange={(e) => updateStage(metricIndex, stageIndex, { description: e.target.value })} placeholder="阶段描述" />
              </div>
              <button className="bg-transparent border border-red-500/30 text-red-400 px-2 py-1 rounded text-xs cursor-pointer" type="button" onClick={() => updateMetric(metricIndex, { stages: metric.stages.filter((_, i) => i !== stageIndex) })}>删</button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
