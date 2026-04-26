import { useState, useRef } from "react";
import { uploadImage, generateImage } from "../services/api";
import { useConnectionStore } from "../stores/connectionStore";
import type { Connection } from "../types";

interface ImagePickerProps {
  /** 当前图片 URL（相对路径如 /api/images/xxx.png 或完整 URL） */
  value: string | null | undefined;
  /** 图片变更回调，返回新的图片 URL */
  onChange: (url: string | null) => void;
  /** AI 生图时的默认提示词 */
  promptHint?: string;
  /** 组件尺寸（px），默认 80 */
  size?: number;
  /** 额外 className */
  className?: string;
}

export default function ImagePicker({
  value,
  onChange,
  promptHint = "",
  size = 80,
  className = "",
}: ImagePickerProps) {
  const [uploading, setUploading] = useState(false);
  const [showGenModal, setShowGenModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------- Upload ----------
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadImage(file);
      onChange(result.url);
    } catch (err: any) {
      alert("上传失败: " + (err.message || String(err)));
    } finally {
      setUploading(false);
      // reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ---------- Generate ----------
  const handleGenerate = (url: string) => {
    onChange(url);
    setShowGenModal(false);
  };

  // ---------- Render ----------
  const hasImage = !!value;

  return (
    <>
      <div
        className={`relative group inline-flex flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        {/* Image or placeholder */}
        {hasImage ? (
          <img
            src={value!}
            alt=""
            className="w-full h-full object-cover rounded-lg border border-gray-600"
          />
        ) : (
          <div className="w-full h-full rounded-lg border-2 border-dashed border-gray-500 flex items-center justify-center bg-gray-800/50">
            <svg
              className="w-6 h-6 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
              />
            </svg>
          </div>
        )}

        {/* Hover overlay with action buttons */}
        <div className="absolute inset-0 rounded-lg bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end gap-1 p-1">
          {/* Upload button */}
          <button
            type="button"
            title="上传图片"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="w-7 h-7 rounded bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white text-sm transition-colors"
          >
            {uploading ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            )}
          </button>

          {/* AI Generate button */}
          <button
            type="button"
            title="AI 生成图片"
            onClick={() => setShowGenModal(true)}
            className="w-7 h-7 rounded bg-purple-700 hover:bg-purple-600 flex items-center justify-center text-white text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
          </button>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* AI Generation Modal */}
      {showGenModal && (
        <ImageGenModal
          promptHint={promptHint}
          onGenerated={handleGenerate}
          onClose={() => setShowGenModal(false)}
        />
      )}
    </>
  );
}

// ============================================================================
// ImageGenModal — AI 图片生成弹窗
// ============================================================================

function ImageGenModal({
  promptHint,
  onGenerated,
  onClose,
}: {
  promptHint: string;
  onGenerated: (url: string) => void;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState(promptHint);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const connections = useConnectionStore((s) => s.connections);
  const imageGenConnections = connections.filter(
    (c) => c.connection_type === "image_generation"
  );

  // Auto-select the default or first image_generation connection
  const defaultConnId =
    imageGenConnections.find((c) => c.is_default)?.id ??
    (imageGenConnections.length > 0 ? imageGenConnections[0].id : null);

  const activeConnId = selectedConnectionId ?? defaultConnId;

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("请输入提示词");
      return;
    }
    if (!activeConnId) {
      setError("没有可用的文生图连接，请先在连接管理中添加");
      return;
    }

    setGenerating(true);
    setError(null);
    setPreviewUrl(null);

    try {
      const result = await generateImage({
        prompt: prompt.trim(),
        connection_id: activeConnId,
      });
      if (result.success && result.url) {
        setPreviewUrl(result.url);
      } else {
        setError(result.message || "生成失败");
      }
    } catch (err: any) {
      setError("生成请求失败: " + (err.message || String(err)));
    } finally {
      setGenerating(false);
    }
  };

  const handleConfirm = () => {
    if (previewUrl) {
      onGenerated(previewUrl);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">AI 生成图片</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Prompt */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            提示词
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-600 bg-gray-700 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            placeholder="描述你想生成的图片..."
          />
        </div>

        {/* Connection selector */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            文生图连接
          </label>
          {imageGenConnections.length === 0 ? (
            <p className="text-sm text-yellow-400">
              暂无文生图连接，请先在「连接管理」中添加类型为「文生图」的连接
            </p>
          ) : (
            <select
              value={activeConnId ?? ""}
              onChange={(e) => setSelectedConnectionId(e.target.value || null)}
              className="w-full rounded-lg border border-gray-600 bg-gray-700 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {imageGenConnections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.model_name})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="text-sm text-red-400 bg-red-900/30 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* Preview */}
        {previewUrl && (
          <div className="flex justify-center">
            <img
              src={previewUrl}
              alt="生成预览"
              className="max-w-full max-h-64 rounded-lg border border-gray-600 object-contain"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          {!previewUrl ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating || !activeConnId || !prompt.trim()}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors flex items-center gap-2"
              >
                {generating && (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                )}
                {generating ? "生成中..." : "生成"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setPreviewUrl(null)}
                className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
              >
                重新生成
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-green-600 hover:bg-green-500 text-white transition-colors"
              >
                使用此图片
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
