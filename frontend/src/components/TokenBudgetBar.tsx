import { useChatStore } from "../stores/chatStore";
import type { TokenBudgetInfo } from "../types";

export default function TokenBudgetBar() {
  const budget = useChatStore((s) => s.tokenBudget);
  if (!budget) return null;

  const total = budget.total || 1;
  const pct = (v: number) => `${((v / total) * 100).toFixed(1)}%`;

  const segments: Array<{ key: string; value: number; cls: string; label: string }> = [
    { key: "system", value: budget.system_prompt, cls: "seg-system", label: "系统" },
    { key: "state", value: budget.state, cls: "seg-state", label: "状态" },
    { key: "summary", value: budget.summary, cls: "seg-summary", label: "摘要" },
    { key: "messages", value: budget.messages, cls: "seg-messages", label: "消息" },
    { key: "reserved", value: budget.reserved, cls: "seg-reserved", label: "预留" },
    { key: "remaining", value: budget.remaining, cls: "seg-remaining", label: "" },
  ];

  return (
    <div className="w-full bg-[var(--bg-primary)] px-4 py-2 border-t border-[var(--border)] bottom-0">
      <div className="max-w-4xl mx-auto">
        <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-800 gap-[1px]">
          {segments.map((s) => (
            <div
              key={s.key}
              className={`transition-all duration-300 ${
                s.key === "system" ? "bg-purple-500" :
                s.key === "state" ? "bg-cyan-500" :
                s.key === "summary" ? "bg-amber-500" :
                s.key === "messages" ? "bg-emerald-500" :
                s.key === "reserved" ? "bg-slate-500" : "bg-[var(--bg-surface)]"
              }`}
              style={{ width: pct(s.value) }}
              title={`${s.label || "剩余"}: ${s.value} tokens`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-2 text-[10px] text-gray-400 font-medium">
          <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-purple-500 mr-1.5"></span>系统 {budget.system_prompt}</span>
          <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-cyan-500 mr-1.5"></span>状态 {budget.state}</span>
          <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-amber-500 mr-1.5"></span>摘要 {budget.summary}</span>
          <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5"></span>消息 {budget.messages}</span>
          <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-slate-500 mr-1.5"></span>预留 {budget.reserved}</span>
        </div>
      </div>
    </div>
  );
}
