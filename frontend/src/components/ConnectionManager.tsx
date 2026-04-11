import { useEffect, useState } from "react";
import { useConnectionStore } from "../stores/connectionStore";
import type { Connection } from "../types";

export default function ConnectionManager({ onClose }: { onClose: () => void }) {
  const { connections, loading, fetchConnections, addConnection, editConnection, removeConnection } =
    useConnectionStore();
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const handleAdd = async () => {
    const c = await addConnection({
      name: "新连接",
      api_key: "",
      api_base_url: "https://api.openai.com/v1",
      model_name: "gpt-4o-mini"
    });
    setEditingId(c.id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此连接？")) return;
    await removeConnection(id);
    if (editingId === id) setEditingId(null);
  };

  const editingConnection = connections.find((c) => c.id === editingId);

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center animate-[fadeIn_0.15s_ease-out]" onClick={onClose}>
      <div className="w-[90vw] max-w-[1000px] h-[80vh] bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-3 bg-[var(--bg-secondary)]">
          <h2 className="text-base font-semibold">🔗 连接管理</h2>
          <button className="bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2 rounded-lg text-[13px] cursor-pointer border-none transition-colors" onClick={handleAdd}>
            + 新建连接
          </button>
          <div className="flex-1" />
          <button className="bg-transparent border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] px-4 py-2 rounded-lg text-[13px] cursor-pointer transition-colors" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="flex-1 flex overflow-hidden">
          {/* Left: connection list */}
          <div className="w-[300px] min-w-[300px] border-r border-[var(--border)] overflow-y-auto p-3 minimal-scrollbar">
            {loading && <div className="p-6 text-center text-[var(--text-secondary)] text-[13px]">加载中...</div>}
            {!loading && connections.length === 0 && (
              <div className="p-6 text-center text-[var(--text-secondary)] text-[13px]">暂无连接，点击上方按钮创建</div>
            )}
            {connections.map((c) => (
              <div
                key={c.id}
                className={`p-3 rounded-lg border-l-[3px] border-l-[var(--accent)] bg-[var(--bg-surface)] mb-2 cursor-pointer relative transition-colors hover:bg-[var(--bg-tertiary)] group ${c.id === editingId ? "ring-1 ring-[var(--accent)] bg-[var(--bg-tertiary)]" : ""}`}
                onClick={() => setEditingId(c.id)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl leading-none">🔗</span>
                  <span className="text-sm font-semibold">{c.name || "未命名连接"}</span>
                  {c.is_default && <span className="text-[10px] bg-indigo-500 text-white px-1.5 py-0.5 rounded-full font-medium">默认</span>}
                </div>
                <div className="text-xs text-[var(--text-secondary)] overflow-hidden text-ellipsis whitespace-nowrap">
                  {c.model_name || "未指定模型"}
                </div>
                <button
                  className="absolute top-2 right-2 bg-transparent border-none cursor-pointer text-sm opacity-0 group-hover:opacity-100 transition-opacity p-0 leading-none"
                  onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                >
                  🗑
                </button>
              </div>
            ))}
          </div>

          {/* Right: edit form */}
          <div className="flex-1 overflow-y-auto p-5 minimal-scrollbar">
            {editingConnection ? (
              <ConnectionForm
                key={editingConnection.id}
                connection={editingConnection}
                onSave={(data) => editConnection(editingConnection.id, data)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)] gap-3">
                <div className="text-5xl opacity-30">🔗</div>
                <div>选择或新建一个连接来编辑</div>
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
  api_key: string;
  api_base_url: string;
  model_name: string;
  is_default: boolean;
}

function ConnectionForm({
  connection,
  onSave,
}: {
  connection: Connection;
  onSave: (data: Partial<FormData>) => Promise<unknown>;
}) {
  const [form, setForm] = useState<FormData>({
    name: connection.name,
    api_key: connection.api_key,
    api_base_url: connection.api_base_url,
    model_name: connection.model_name,
    is_default: connection.is_default,
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
          placeholder="连接名称 (如：OpenAI, Claude 等)"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-[var(--text-secondary)]">API Key</label>
        <input
          type="password"
          className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm font-[inherit] outline-none focus:border-indigo-500/60 transition-colors w-full"
          value={form.api_key}
          onChange={(e) => update("api_key", e.target.value)}
          placeholder="sk-..."
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-[var(--text-secondary)]">API Base URL</label>
        <input
          className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm font-[inherit] outline-none focus:border-indigo-500/60 transition-colors w-full"
          value={form.api_base_url}
          onChange={(e) => update("api_base_url", e.target.value)}
          placeholder="https://api.openai.com/v1"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-[var(--text-secondary)]">模型名称</label>
        <input
          className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm font-[inherit] outline-none focus:border-indigo-500/60 transition-colors w-full"
          value={form.model_name}
          onChange={(e) => update("model_name", e.target.value)}
          placeholder="gpt-4o-mini"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-2 text-[13px] font-medium text-[var(--text-secondary)] cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_default}
            onChange={(e) => update("is_default", e.target.checked)}
          />
          设为默认连接
        </label>
      </div>

      <div className="pt-2 flex justify-end">
        <button
          className="bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2 rounded-lg text-[13px] cursor-pointer border-none transition-colors disabled:opacity-50"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "保存中..." : "💾 保存"}
        </button>
      </div>
    </div>
  );
}
