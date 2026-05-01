import { useEffect, useState } from "react";
import { useConnectionStore } from "../stores/connectionStore";
import { fetchModels as fetchModelsApi } from "../services/api";
import type { Connection, ConnectionType, ImageGenConfig, TestConnectionResult } from "../types";

// --- Preset templates for image generation ---
const IMAGE_GEN_PRESETS = [
  {
    label: "豆包 Volcengine",
    name: "豆包文生图",
    api_base_url: "https://visual.volcengineapi.com",
    model_name: "doubao-seedream-3-0-t2i-250415",
  },
  {
    label: "百度千帆",
    name: "千帆文生图",
    api_base_url: "https://qianfan.baidubce.com/v2",
    model_name: "stable-diffusion-xl",
  },
];

const IMAGE_SIZE_OPTIONS = ["1024x1024", "512x512", "768x768", "1024x1792", "1792x1024"];

export default function ConnectionManager({ onClose }: { onClose: () => void }) {
  const { connections, loading, fetchConnections, addConnection, editConnection, removeConnection } =
    useConnectionStore();
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const handleAddLLM = async () => {
    const c = await addConnection({
      name: "新连接",
      connection_type: "llm",
      api_key: "",
      api_base_url: "https://api.openai.com/v1",
      model_name: "gpt-4o-mini",
    });
    setEditingId(c.id);
  };

  const handleAddImageGen = async (preset?: typeof IMAGE_GEN_PRESETS[number]) => {
    const c = await addConnection({
      name: preset?.name || "文生图连接",
      connection_type: "image_generation",
      api_key: "",
      api_base_url: preset?.api_base_url || "",
      model_name: preset?.model_name || "",
      image_gen_config: { image_size: "1024x1024", n: 1 },
    });
    setEditingId(c.id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此连接？")) return;
    await removeConnection(id);
    if (editingId === id) setEditingId(null);
  };

  const editingConnection = connections.find((c) => c.id === editingId);

  const getTypeIcon = (c: Connection) => {
    return c.connection_type === "image_generation" ? "🎨" : "🔗";
  };

  const getTypeLabel = (c: Connection) => {
    return c.connection_type === "image_generation" ? "文生图" : "LLM";
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center animate-[fadeIn_0.15s_ease-out]" onClick={onClose}>
      <div className="w-[90vw] max-w-[1000px] h-[80vh] bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-3 bg-[var(--bg-secondary)]">
          <h2 className="text-base font-semibold">🔗 连接管理</h2>
          <button className="bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2 rounded-lg text-[13px] cursor-pointer border-none transition-colors" onClick={handleAddLLM}>
            + LLM 连接
          </button>
          <button className="bg-purple-500 hover:bg-purple-400 text-white px-4 py-2 rounded-lg text-[13px] cursor-pointer border-none transition-colors" onClick={() => handleAddImageGen()}>
            + 文生图连接
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
                className={`p-3 rounded-lg border-l-[3px] ${c.connection_type === "image_generation" ? "border-l-purple-500" : "border-l-[var(--accent)]"} bg-[var(--bg-surface)] mb-2 cursor-pointer relative transition-colors hover:bg-[var(--bg-tertiary)] group ${c.id === editingId ? "ring-1 ring-[var(--accent)] bg-[var(--bg-tertiary)]" : ""}`}
                onClick={() => setEditingId(c.id)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl leading-none">{getTypeIcon(c)}</span>
                  <span className="text-sm font-semibold">{c.name || "未命名连接"}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${c.connection_type === "image_generation" ? "bg-purple-500/30 text-purple-300" : "bg-indigo-500/30 text-indigo-300"}`}>
                    {getTypeLabel(c)}
                  </span>
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

interface LLMFormData {
  name: string;
  connection_type: ConnectionType;
  api_key: string;
  api_base_url: string;
  model_name: string;
  is_default: boolean;
}

interface ImageGenFormData extends LLMFormData {
  image_gen_config: ImageGenConfig;
}

type FormData = LLMFormData | ImageGenFormData;

function ConnectionForm({
  connection,
  onSave,
}: {
  connection: Connection;
  onSave: (data: Partial<FormData>) => Promise<unknown>;
}) {
  const { testConnection } = useConnectionStore();
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [modelList, setModelList] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchModelsError, setFetchModelsError] = useState<string | null>(null);

  const isImageGen = connection.connection_type === "image_generation";

  const getInitialFormData = (): FormData => {
    const base: LLMFormData = {
      name: connection.name,
      connection_type: connection.connection_type,
      api_key: connection.api_key,
      api_base_url: connection.api_base_url,
      model_name: connection.model_name,
      is_default: connection.is_default,
    };
    if (isImageGen) {
      return {
        ...base,
        image_gen_config: connection.image_gen_config || { image_size: "1024x1024", n: 1 },
      };
    }
    return base;
  };

  const [form, setForm] = useState<FormData>(getInitialFormData);

  const update = <K extends keyof FormData>(key: K, val: FormData[K]) =>
    setForm((f) => ({ ...f, [key]: val } as FormData));

  const updateImageGenConfig = (key: keyof ImageGenConfig, val: string | number) =>
    setForm((f) => {
      if (!("image_gen_config" in f)) return f;
      return {
        ...f,
        image_gen_config: { ...f.image_gen_config, [key]: val },
      } as ImageGenFormData;
    });

  const handleSave = async () => {
    await onSave(form);
  };

  const handleTest = async () => {
    // Save first, then test
    await onSave(form);
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testConnection(connection.id);
      setTestResult(result);
    } catch (err) {
      setTestResult({ success: false, message: "测试请求失败" });
    } finally {
      setTesting(false);
    }
  };

  const handleFetchModels = async () => {
    // Save first, then fetch models
    await onSave(form);
    setFetchingModels(true);
    setFetchModelsError(null);
    setModelList([]);
    try {
      const result = await fetchModelsApi(connection.id);
      if (result.success) {
        setModelList(result.models);
        setFetchModelsError(null);
      } else {
        setFetchModelsError(result.message);
      }
    } catch {
      setFetchModelsError("查询模型列表失败");
    } finally {
      setFetchingModels(false);
    }
  };

  const applyPreset = (preset: typeof IMAGE_GEN_PRESETS[number]) => {
    setForm((f) => ({
      ...f,
      name: preset.name,
      api_base_url: preset.api_base_url,
      model_name: preset.model_name,
    } as FormData));
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Connection Type Selector */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-[var(--text-secondary)]">连接类型</label>
        <div className="flex gap-2">
          <button
            className={`px-4 py-2 rounded-lg text-[13px] cursor-pointer border transition-colors ${
              form.connection_type === "llm"
                ? "bg-indigo-500/20 border-indigo-500 text-indigo-300"
                : "bg-transparent border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
            }`}
            onClick={() => {
              if (form.connection_type !== "llm") {
                update("connection_type", "llm");
              }
            }}
          >
            🔗 LLM 连接
          </button>
          <button
            className={`px-4 py-2 rounded-lg text-[13px] cursor-pointer border transition-colors ${
              form.connection_type === "image_generation"
                ? "bg-purple-500/20 border-purple-500 text-purple-300"
                : "bg-transparent border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
            }`}
            onClick={() => {
              if (form.connection_type !== "image_generation") {
                setForm({
                  ...form,
                  connection_type: "image_generation",
                  image_gen_config: { image_size: "1024x1024", n: 1 },
                } as ImageGenFormData);
              }
            }}
          >
            🎨 文生图连接
          </button>
        </div>
      </div>

      {/* Preset buttons for image gen */}
      {form.connection_type === "image_generation" && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-[var(--text-secondary)]">快捷预设</label>
          <div className="flex gap-2 flex-wrap">
            {IMAGE_GEN_PRESETS.map((preset) => (
              <button
                key={preset.label}
                className="px-3 py-1.5 rounded-lg text-[12px] cursor-pointer border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                onClick={() => applyPreset(preset)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-[var(--text-secondary)]">名称</label>
        <input
          className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm font-[inherit] outline-none focus:border-indigo-500/60 transition-colors w-full"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          placeholder={form.connection_type === "image_generation" ? "文生图连接名称" : "连接名称 (如：OpenAI, Claude 等)"}
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
          placeholder={form.connection_type === "image_generation" ? "https://visual.volcengineapi.com" : "https://api.openai.com/v1"}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-[var(--text-secondary)]">
          {form.connection_type === "image_generation" ? "模型 ID" : "模型名称"}
        </label>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm font-[inherit] outline-none focus:border-indigo-500/60 transition-colors w-full"
              value={form.model_name}
              onChange={(e) => update("model_name", e.target.value)}
              placeholder={form.connection_type === "image_generation" ? "doubao-seedream-3-0-t2i-250415" : "gpt-4o-mini"}
              list={`model-list-${connection.id}`}
            />
            <datalist id={`model-list-${connection.id}`}>
              {modelList.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
          <button
            className="bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] px-3 py-2 rounded-lg text-[12px] cursor-pointer transition-colors disabled:opacity-50 whitespace-nowrap"
            onClick={handleFetchModels}
            disabled={fetchingModels || testing}
          >
            {fetchingModels ? "查询中..." : "📋 获取模型"}
          </button>
        </div>
        {fetchModelsError && (
          <div className="text-[12px] text-red-400">{fetchModelsError}</div>
        )}
        {modelList.length > 0 && !fetchModelsError && (
          <div className="text-[12px] text-green-400">已加载 {modelList.length} 个模型，可从下拉列表选择或手动输入</div>
        )}
      </div>

      {/* Image gen specific fields */}
      {form.connection_type === "image_generation" && "image_gen_config" in form && (
        <>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[var(--text-secondary)]">图片尺寸</label>
            <select
              className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm font-[inherit] outline-none focus:border-indigo-500/60 transition-colors w-full cursor-pointer"
              value={form.image_gen_config.image_size}
              onChange={(e) => updateImageGenConfig("image_size", e.target.value)}
            >
              {IMAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[var(--text-secondary)]">生成数量</label>
            <input
              type="number"
              min={1}
              max={4}
              className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm font-[inherit] outline-none focus:border-indigo-500/60 transition-colors w-full"
              value={form.image_gen_config.n}
              onChange={(e) => updateImageGenConfig("n", Math.max(1, Math.min(4, parseInt(e.target.value) || 1)))}
            />
          </div>
        </>
      )}

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

      {/* Test result */}
      {testResult && (
        <div className={`p-3 rounded-lg text-[13px] border ${
          testResult.success
            ? "bg-green-500/10 border-green-500/30 text-green-400"
            : "bg-red-500/10 border-red-500/30 text-red-400"
        }`}>
          <span className="font-medium">{testResult.success ? "✓" : "✗"}</span> {testResult.message}
        </div>
      )}

      <div className="pt-2 flex justify-end gap-2">
        <button
          className="bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] px-4 py-2 rounded-lg text-[13px] cursor-pointer transition-colors disabled:opacity-50"
          onClick={handleTest}
          disabled={testing}
        >
          {testing ? "测试中..." : "🔍 测试连接"}
        </button>
        <button
          className="bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2 rounded-lg text-[13px] cursor-pointer border-none transition-colors disabled:opacity-50"
          onClick={handleSave}
          disabled={testing}
        >
          💾 保存
        </button>
      </div>
    </div>
  );
}
