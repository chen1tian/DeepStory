import { useState } from "react";
import { useSessionStore } from "../stores/sessionStore";
import { useUIStore } from "../stores/uiStore";
import { generateUI, saveCustomUI, getCustomUI } from "../services/api";
import CustomUIRenderer from "./CustomUIRenderer";

export default function EditMode() {
  const currentSessionId = useSessionStore((s) => s.currentSessionId);
  const addToast = useUIStore((s) => s.addToast);
  const [template, setTemplate] = useState("bubble");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!currentSessionId || !description.trim()) return;
    setLoading(true);
    try {
      const { html } = await generateUI(currentSessionId, description, template);
      await saveCustomUI(currentSessionId, html);
      addToast("界面已生成并保存", "success");
      // Force iframe reload by toggling key or reloading page
      window.location.reload();
    } catch {
      addToast("生成失败，请重试", "error");
    } finally {
      setLoading(false);
    }
  };

  if (!currentSessionId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)] gap-3">
        <p>请先选择一个对话</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="px-4 py-2 border-b border-[var(--border)] flex gap-2 items-center bg-[var(--bg-secondary)]">
        <select
          className="bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] rounded-md px-2.5 py-1.5 text-[13px] outline-none"
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
        >
          <option value="bubble">气泡样式</option>
          <option value="card">卡片样式</option>
          <option value="rpg">RPG 样式</option>
        </select>
        <input
          className="bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] rounded-md px-2.5 py-1.5 text-[13px] outline-none flex-1"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="描述你想要的界面效果..."
          onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
        />
        <button
          className="bg-indigo-500 border-none text-white px-3.5 py-1.5 rounded-md cursor-pointer text-[13px] hover:bg-indigo-400 disabled:opacity-50 transition-colors"
          onClick={handleGenerate}
          disabled={loading || !description.trim()}
        >
          {loading ? "生成中..." : "🎨 生成"}
        </button>
      </div>
      <CustomUIRenderer />
    </div>
  );
}
