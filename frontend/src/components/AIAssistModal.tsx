import { useState } from "react";
import { aiPolish } from "../services/api";

interface Props {
  /** Current text in the field */
  original: string;
  /** "background" | "opener" */
  fieldType: string;
  /** Called when user accepts the AI result */
  onAccept: (text: string) => void;
  onClose: () => void;
}

export default function AIAssistModal({
  original,
  fieldType,
  onAccept,
  onClose,
}: Props) {
  const [instruction, setInstruction] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!instruction.trim()) return;
    setLoading(true);
    setError("");
    setResult("");
    try {
      const resp = await aiPolish(original, instruction.trim(), fieldType);
      setResult(resp.result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "请求失败");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    onAccept(result);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const fieldLabel = fieldType === "background" ? "故事背景" : "开场白";

  return (
    <div className="fixed inset-0 bg-black/65 z-[200] flex items-center justify-center animate-[fadeIn_0.15s_ease-out]" onClick={onClose}>
      <div className="w-[560px] max-w-[90vw] max-h-[80vh] bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-secondary)]">
          <h3 className="text-[15px] font-semibold bg-gradient-to-br from-violet-400 to-indigo-400 bg-clip-text text-transparent">✨ AI 润色 — {fieldLabel}</h3>
          <button className="bg-transparent border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] px-2 py-1 rounded-lg text-[13px] cursor-pointer transition-colors" onClick={onClose}>
            ✕
          </button>
        </div>

        {original.trim() && (
          <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--bg-surface)]">
            <div className="text-[11px] text-[var(--text-secondary)] mb-1">当前文本</div>
            <div className="text-[13px] leading-relaxed max-h-[100px] overflow-y-auto whitespace-pre-wrap text-[var(--text-secondary)]">{original}</div>
          </div>
        )}

        <div className="px-5 pt-4 flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-[var(--text-secondary)]">告诉 AI 你想要的效果</label>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              fieldType === "background"
                ? "例如：让背景更有古风韵味，增加环境描写…"
                : "例如：让开场白更有悬疑感，增加对话…"
            }
            rows={3}
            autoFocus
            className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text-primary)] text-sm font-[inherit] resize-y min-h-[60px] outline-none focus:border-indigo-500/60 transition-colors w-full"
          />
          <div className="text-[11px] text-[var(--text-secondary)] opacity-60 text-right">Ctrl+Enter 提交</div>
        </div>

        <div className="px-5 py-3 flex justify-end">
          <button
            className="bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2 rounded-lg text-[13px] cursor-pointer border-none transition-colors disabled:opacity-50"
            onClick={handleSubmit}
            disabled={loading || !instruction.trim()}
          >
            {loading ? "⏳ AI 思考中…" : "🚀 生成"}
          </button>
        </div>

        {error && <div className="px-5 py-2 text-red-500 text-[13px]">{error}</div>}

        {result && (
          <div className="px-5 pb-4 flex flex-col gap-2">
            <div className="text-[11px] text-[var(--text-secondary)] mb-0.5">AI 生成结果</div>
            <div className="bg-[var(--bg-surface)] border border-indigo-500/60 rounded-lg p-3 text-[13px] leading-relaxed whitespace-pre-wrap max-h-[200px] overflow-y-auto">{result}</div>
            <div className="flex gap-2 justify-end">
              <button className="bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2 rounded-lg text-[13px] cursor-pointer border-none transition-colors" onClick={handleAccept}>
                ✅ 采用此结果
              </button>
              <button className="bg-transparent border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] px-4 py-2 rounded-lg text-[13px] cursor-pointer transition-colors disabled:opacity-50" onClick={handleSubmit} disabled={loading}>
                🔄 重新生成
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
