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
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <div className="token-budget-bar">
        {segments.map((s) => (
          <div
            key={s.key}
            className={`segment ${s.cls}`}
            style={{ width: pct(s.value) }}
            title={`${s.label || s.key}: ${s.value} tokens`}
          />
        ))}
      </div>
      <div className="token-budget-label">
        <span className="label-system">系统 {budget.system_prompt}</span>
        <span className="label-state">状态 {budget.state}</span>
        <span className="label-summary">摘要 {budget.summary}</span>
        <span className="label-messages">消息 {budget.messages}</span>
        <span className="label-reserved">预留 {budget.reserved}</span>
      </div>
    </div>
  );
}
