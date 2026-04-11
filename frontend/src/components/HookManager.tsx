import { useEffect, useState } from "react";
import { useHookStore } from "../stores/hookStore";
import { useConnectionStore } from "../stores/connectionStore";
import type { ChatHook, HookAction, HookActionType, UpdateHookRequest } from "../types";

const ACTION_LABELS: Record<HookActionType, string> = {
  render_branch_options: "🌿 渲染分支选项",
  show_panel: "📋 显示面板",
  inject_to_input: "✏️ 注入输入框",
  send_message: "📤 自动发送消息",
  show_toast: "🔔 显示通知",
  custom_script: "⚙️ 自定义脚本",
};

const ACTION_SCHEMA_HINTS: Record<HookActionType, string> = {
  render_branch_options: '数组，每项包含 "label"（简短标题）和 "prompt"（用户将发送的完整文字）字段',
  show_panel: "字符串，支持 Markdown 格式",
  inject_to_input: "字符串，将直接填入聊天输入框",
  send_message: "字符串，将作为用户消息自动发送",
  show_toast: "字符串，作为通知内容显示",
  custom_script: "任意格式，脚本通过 context.result 访问",
};

const DEFAULT_SCRIPTS: Record<HookActionType, string> = {
  render_branch_options: "",
  show_panel: "",
  inject_to_input: "",
  send_message: "",
  show_toast: "",
  custom_script:
    "// context 对象提供以下 API:\n// context.result       - LLM 返回的结果\n// context.sessionId    - 当前会话 ID\n// context.state        - 当前 RPG 状态\n// context.sendMessage(text)              - 发送消息\n// context.sendBranchMessage(text, fromId) - 发送分支消息\n// context.showToast(text, type?)          - 显示通知 (type: 'info'|'success'|'error')\n// context.renderHTML(html)               - 临时渲染 HTML\n\nconsole.log('Hook result:', context.result);\ncontext.showToast('脚本执行完成');",
};

interface HookFormProps {
  hook: ChatHook;
  onSave: (data: UpdateHookRequest) => Promise<void>;
}

function HookForm({ hook, onSave }: HookFormProps) {
  const { connections, fetchConnections } = useConnectionStore();
  const [form, setForm] = useState<{
    name: string;
    enabled: boolean;
    trigger: "chat_complete" | "state_updated";
    context_messages: number;
    include_state: boolean;
    prompt: string;
    response_key: string;
    response_schema: string;
    connection_id: string | null;
    action: HookAction;
  }>({
    name: hook.name,
    enabled: hook.enabled,
    trigger: hook.trigger,
    context_messages: hook.context_messages,
    include_state: hook.include_state,
    prompt: hook.prompt,
    response_key: hook.response_key,
    response_schema: hook.response_schema,
    connection_id: hook.connection_id,
    action: { ...hook.action },
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateAction = <K extends keyof HookAction>(key: K, value: HookAction[K]) => {
    setForm((prev) => ({ ...prev, action: { ...prev.action, [key]: value } }));
  };

  const handleActionTypeChange = (type: HookActionType) => {
    setForm((prev) => ({
      ...prev,
      response_schema: ACTION_SCHEMA_HINTS[type],
      action: {
        ...prev.action,
        type,
        script: DEFAULT_SCRIPTS[type],
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto minimal-scrollbar h-full">
      {/* Name & Enable */}
      <div className="flex gap-3 items-center">
        <input
          className="flex-1 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-500/50"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="Hook 名称"
        />
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
          <input
            type="checkbox"
            className="w-4 h-4 rounded accent-indigo-500"
            checked={form.enabled}
            onChange={(e) => update("enabled", e.target.checked)}
          />
          启用
        </label>
      </div>

      {/* Trigger */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">触发事件</label>
        <select
          className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-500/50"
          value={form.trigger}
          onChange={(e) => update("trigger", e.target.value as "chat_complete" | "state_updated")}
        >
          <option value="chat_complete">chat_complete — AI 回复完成后</option>
          <option value="state_updated">state_updated — 状态提取完成后</option>
        </select>
      </div>

      {/* Context */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">上下文</label>
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-1 flex-1">
            <span className="text-xs text-gray-500">包含最近 {form.context_messages} 条消息</span>
            <input
              type="range"
              min={0}
              max={20}
              value={form.context_messages}
              onChange={(e) => update("context_messages", Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between text-[10px] text-gray-600">
              <span>0</span>
              <span>20</span>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none whitespace-nowrap">
            <input
              type="checkbox"
              className="w-4 h-4 rounded accent-indigo-500"
              checked={form.include_state}
              onChange={(e) => update("include_state", e.target.checked)}
            />
            包含角色状态
          </label>
        </div>
      </div>

      {/* Connection override */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          连接（可选，留空则使用当前对话连接）
        </label>
        <select
          className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-500/50"
          value={form.connection_id ?? ""}
          onChange={(e) => update("connection_id", e.target.value || null)}
        >
          <option value="">自动（跟随对话连接）</option>
          {connections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Prompt */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">提示词任务</label>
        <textarea
          className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-500/50 resize-none minimal-scrollbar"
          rows={4}
          value={form.prompt}
          onChange={(e) => update("prompt", e.target.value)}
          placeholder="描述你希望 AI 做什么，例如：根据最近的对话，生成3个合理的用户行动选项..."
        />
      </div>

      {/* Response key */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          响应键名
          <span className="ml-1 text-gray-600 normal-case font-normal">（在批量请求的 JSON 中标识此 Hook 的结果）</span>
        </label>
        <input
          className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-500/50 font-mono"
          value={form.response_key}
          onChange={(e) => update("response_key", e.target.value)}
          placeholder="例如: branch_options"
        />
      </div>

      {/* Response schema */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          响应格式说明
          <span className="ml-1 text-gray-600 normal-case font-normal">（告知 AI 此键应返回什么格式）</span>
        </label>
        <textarea
          className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-500/50 resize-none minimal-scrollbar"
          rows={2}
          value={form.response_schema}
          onChange={(e) => update("response_schema", e.target.value)}
          placeholder={ACTION_SCHEMA_HINTS[form.action.type]}
        />
      </div>

      {/* Action type */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">响应处理方式</label>
        <select
          className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-500/50"
          value={form.action.type}
          onChange={(e) => handleActionTypeChange(e.target.value as HookActionType)}
        >
          {(Object.keys(ACTION_LABELS) as HookActionType[]).map((t) => (
            <option key={t} value={t}>
              {ACTION_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      {/* Action config */}
      {form.action.type === "show_panel" && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">面板标题</label>
          <input
            className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-500/50"
            value={form.action.panel_title}
            onChange={(e) => updateAction("panel_title", e.target.value)}
            placeholder="分析结果"
          />
        </div>
      )}

      {form.action.type === "custom_script" && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            自定义 JS 脚本
          </label>
          <textarea
            className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-[12px] text-gray-200 outline-none focus:border-indigo-500/50 resize-none minimal-scrollbar font-mono"
            rows={10}
            value={form.action.script}
            onChange={(e) => updateAction("script", e.target.value)}
          />
        </div>
      )}

      {/* Save */}
      <button
        className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition-all shadow-md mt-2"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? "保存中…" : "保存"}
      </button>
    </div>
  );
}

// ── Main HookManager ─────────────────────────────────────────────────────────

export default function HookManager({ onClose }: { onClose: () => void }) {
  const { hooks, loading, fetchHooks, addHook, editHook, removeHook } = useHookStore();
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchHooks();
  }, [fetchHooks]);

  const handleAdd = async () => {
    const h = await addHook({
      name: "新 Hook",
      trigger: "chat_complete",
      context_messages: 6,
      action: { type: "show_panel", panel_title: "", script: "" },
    });
    setEditingId(h.id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此 Hook？")) return;
    await removeHook(id);
    if (editingId === id) setEditingId(null);
  };

  const editingHook = hooks.find((h) => h.id === editingId);

  return (
    <div className="story-manager-overlay" onClick={onClose}>
      <div className="story-manager" onClick={(e) => e.stopPropagation()}>
        <div className="story-manager-header">
          <h2>🔗 Chat Hook 管理</h2>
          <button className="btn" onClick={handleAdd}>
            + 新建 Hook
          </button>
          <div className="spacer" />
          <button className="btn-ghost btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="story-manager-body">
          {/* Left: hook list */}
          <div className="story-list-panel">
            {loading && <div className="story-loading">加载中…</div>}
            {!loading && hooks.length === 0 && (
              <div className="story-loading">暂无 Hook，点击上方按钮创建</div>
            )}
            {hooks.map((h) => (
              <div
                key={h.id}
                className={`story-card ${h.id === editingId ? "active" : ""}`}
                onClick={() => setEditingId(h.id)}
              >
                <div className="protagonist-card-header">
                  <span className="protagonist-avatar">{h.enabled ? "🔗" : "⛔"}</span>
                  <span className="story-card-title">{h.name || "未命名 Hook"}</span>
                  {!h.enabled && (
                    <span className="text-[10px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">已禁用</span>
                  )}
                </div>
                <div className="story-card-desc text-xs text-gray-500">
                  {h.trigger === "chat_complete" ? "AI 回复后" : "状态更新后"} ·{" "}
                  {h.action.type === "render_branch_options"
                    ? "分支选项"
                    : h.action.type === "show_panel"
                    ? "面板显示"
                    : h.action.type === "custom_script"
                    ? "自定义脚本"
                    : h.action.type}
                </div>
                <button
                  className="story-card-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(h.id);
                  }}
                >
                  🗑
                </button>
              </div>
            ))}
          </div>

          {/* Right: edit form */}
          <div className="story-edit-panel" style={{ padding: 0, overflow: "hidden" }}>
            {editingHook ? (
              <HookForm
                key={editingHook.id}
                hook={editingHook}
                onSave={(data) => editHook(editingHook.id, data)}
              />
            ) : (
              <div className="empty-state">
                <div className="icon">🔗</div>
                <div>选择或新建一个 Hook 来编辑</div>
                <div className="text-xs text-gray-600 mt-2 max-w-xs text-center">
                  每个 Hook 在事件触发后调用 AI，所有同触发事件的 Hook 合并为一次请求
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
