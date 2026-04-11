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
    <div className="story-manager-overlay" onClick={onClose}>
      <div className="story-manager" onClick={(e) => e.stopPropagation()}>
        <div className="story-manager-header">
          <h2>🔗 连接管理</h2>
          <button className="btn" onClick={handleAdd}>
            + 新建连接
          </button>
          <div className="spacer" />
          <button className="btn-ghost btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="story-manager-body">
          {/* Left: connection list */}
          <div className="story-list-panel">
            {loading && <div className="story-loading">加载中...</div>}
            {!loading && connections.length === 0 && (
              <div className="story-loading">暂无连接，点击上方按钮创建</div>
            )}
            {connections.map((c) => (
              <div
                key={c.id}
                className={`story-card ${c.id === editingId ? "active" : ""}`}
                onClick={() => setEditingId(c.id)}
              >
                <div className="protagonist-card-header">
                  <span className="protagonist-avatar">🔗</span>
                  <span className="story-card-title">{c.name || "未命名连接"}</span>
                  {c.is_default && <span className="protagonist-default-badge">默认</span>}
                </div>
                <div className="story-card-desc">
                  {c.model_name || "未指定模型"}
                </div>
                <button
                  className="story-card-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(c.id);
                  }}
                >
                  🗑
                </button>
              </div>
            ))}
          </div>

          {/* Right: edit form */}
          <div className="story-edit-panel">
            {editingConnection ? (
              <ConnectionForm
                key={editingConnection.id}
                connection={editingConnection}
                onSave={(data) => editConnection(editingConnection.id, data)}
              />
            ) : (
              <div className="empty-state">
                <div className="icon">🔗</div>
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
    <div className="story-form">
      <div className="story-form-row">
        <label>名称</label>
        <input
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder="连接名称 (如：OpenAI, Claude 等)"
        />
      </div>

      <div className="story-form-row">
        <label>API Key</label>
        <input
          type="password"
          value={form.api_key}
          onChange={(e) => update("api_key", e.target.value)}
          placeholder="sk-..."
        />
      </div>

      <div className="story-form-row">
        <label>API Base URL</label>
        <input
          value={form.api_base_url}
          onChange={(e) => update("api_base_url", e.target.value)}
          placeholder="https://api.openai.com/v1"
        />
      </div>

      <div className="story-form-row">
        <label>模型名称</label>
        <input
          value={form.model_name}
          onChange={(e) => update("model_name", e.target.value)}
          placeholder="gpt-4o-mini"
        />
      </div>

      <div className="story-form-row">
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={form.is_default}
            onChange={(e) => update("is_default", e.target.checked)}
          />
          设为默认连接
        </label>
      </div>

      <div className="story-form-actions">
        <button className="btn" onClick={handleSave} disabled={saving}>
          {saving ? "保存中..." : "💾 保存"}
        </button>
      </div>
    </div>
  );
}
