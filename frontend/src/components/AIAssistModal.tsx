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
    <div className="ai-assist-overlay" onClick={onClose}>
      <div className="ai-assist-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ai-assist-header">
          <h3>✨ AI 润色 — {fieldLabel}</h3>
          <button className="btn-ghost btn" onClick={onClose} style={{ padding: "4px 8px" }}>
            ✕
          </button>
        </div>

        {original.trim() && (
          <div className="ai-assist-original">
            <div className="label">当前文本</div>
            <div className="ai-assist-original-text">{original}</div>
          </div>
        )}

        <div className="ai-assist-input-section">
          <label>告诉 AI 你想要的效果</label>
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
          />
          <div className="ai-assist-input-hint">Ctrl+Enter 提交</div>
        </div>

        <div className="ai-assist-actions-top">
          <button className="btn" onClick={handleSubmit} disabled={loading || !instruction.trim()}>
            {loading ? "⏳ AI 思考中…" : "🚀 生成"}
          </button>
        </div>

        {error && <div className="ai-assist-error">{error}</div>}

        {result && (
          <div className="ai-assist-result">
            <div className="label">AI 生成结果</div>
            <div className="ai-assist-result-text">{result}</div>
            <div className="ai-assist-result-actions">
              <button className="btn" onClick={handleAccept}>
                ✅ 采用此结果
              </button>
              <button className="btn-ghost btn" onClick={handleSubmit} disabled={loading}>
                🔄 重新生成
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
