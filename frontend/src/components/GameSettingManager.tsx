import { useEffect, useMemo, useState } from "react";
import { useGameSettingStore } from "../stores/gameSettingStore";
import { useSessionStore } from "../stores/sessionStore";
import type { GameSetting } from "../types";

interface FormData {
  name: string;
  description: string;
  content: string;
}

export default function GameSettingManager({ onClose }: { onClose: () => void }) {
  const { settings, loading, fetchSettings, addSetting, editSetting, removeSetting } = useGameSettingStore();
  const sessions = useSessionStore((s) => s.sessions);
  const currentSessionId = useSessionStore((s) => s.currentSessionId);
  const addSettingToSession = useSessionStore((s) => s.addSettingToSession);
  const removeSettingFromSession = useSessionStore((s) => s.removeSettingFromSession);
  const [editingId, setEditingId] = useState<string | null>(null);

  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const activeIds = useMemo(
    () => new Set(currentSession?.active_setting_ids || []),
    [currentSession?.active_setting_ids],
  );

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleAdd = async () => {
    const setting = await addSetting();
    setEditingId(setting.id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除此设定？")) return;
    await removeSetting(id);
    if (editingId === id) setEditingId(null);
  };

  const toggleSessionSetting = async (setting: GameSetting) => {
    if (!currentSessionId) return;
    if (activeIds.has(setting.id)) {
      await removeSettingFromSession(currentSessionId, setting.id);
    } else {
      await addSettingToSession(currentSessionId, setting.id);
    }
  };

  const editingSetting = settings.find((item) => item.id === editingId);

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center animate-[fadeIn_0.15s_ease-out]" onClick={onClose}>
      <div className="w-[calc(100vw-1rem)] max-w-[1100px] h-[calc(100dvh-1rem)] md:w-[92vw] md:h-[82vh] bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 md:px-5 md:py-4 border-b border-[var(--border)] flex flex-wrap items-center gap-3 bg-[var(--bg-secondary)]">
          <h2 className="text-base font-semibold">⚙️ 设定</h2>
          <button className="bg-indigo-500 hover:bg-indigo-400 text-white px-3 py-1.5 rounded-lg text-[13px] cursor-pointer border-none transition-colors" onClick={handleAdd}>
            + 新建设定
          </button>
          <div className="hidden md:block flex-1" />
          <button className="bg-transparent border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] px-3 py-1.5 rounded-lg text-[13px] cursor-pointer transition-colors" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="flex flex-1 flex-col md:flex-row overflow-hidden min-h-0">
          <div className="w-full md:w-[330px] md:min-w-[330px] border-b md:border-b-0 md:border-r border-[var(--border)] overflow-y-auto p-3 minimal-scrollbar max-h-[42vh] md:max-h-none">
            {loading && <div className="text-sm text-[var(--text-secondary)] p-3">加载中…</div>}
            {!loading && settings.length === 0 && (
              <div className="text-sm text-[var(--text-secondary)] p-3">暂无设定，点击上方按钮创建</div>
            )}
            {settings.map((setting) => {
              const active = activeIds.has(setting.id);
              return (
                <div
                  key={setting.id}
                  className={`p-3 rounded-lg border-l-[3px] ${active ? "border-l-emerald-400" : "border-l-[var(--accent)]"} bg-[var(--bg-surface)] mb-2 cursor-pointer relative transition-colors hover:bg-[var(--bg-tertiary)] group${setting.id === editingId ? " ring-1 ring-[var(--accent)] bg-[var(--bg-tertiary)]" : ""}`}
                  onClick={() => setEditingId(setting.id)}
                >
                  <div className="flex items-center gap-2 mb-1 pr-5">
                    <span className="text-base">📖</span>
                    <span className="text-[13px] font-medium text-[var(--text-primary)] flex-1 truncate">{setting.name || "未命名设定"}</span>
                    {active && <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full font-medium">已加入</span>}
                  </div>
                  <div className="text-[12px] text-[var(--text-secondary)] leading-relaxed line-clamp-2 mb-2">
                    {setting.description || setting.content || "暂无内容"}
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      disabled={!currentSessionId}
                      className={`border px-2 py-1 rounded text-xs cursor-pointer transition-colors disabled:opacity-45 disabled:cursor-not-allowed ${
                        active
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
                          : "bg-[var(--bg-primary)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                      }`}
                      onClick={() => toggleSessionSetting(setting)}
                    >
                      {active ? "已在聊天中" : "加入聊天"}
                    </button>
                  </div>
                  <button
                    className="absolute top-2 right-2 bg-transparent border-none cursor-pointer text-sm opacity-0 group-hover:opacity-100 transition-opacity p-0 leading-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(setting.id);
                    }}
                  >
                    🗑
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-5 minimal-scrollbar">
            {editingSetting ? (
              <GameSettingForm
                key={editingSetting.id}
                setting={editingSetting}
                onSave={(data) => editSetting(editingSetting.id, data)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[180px] text-[var(--text-secondary)] gap-3 text-center px-4">
                <div className="text-4xl md:text-5xl opacity-30">📖</div>
                <div className="max-w-[18rem] leading-relaxed">选择或新建一个设定来编辑</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function GameSettingForm({
  setting,
  onSave,
}: {
  setting: GameSetting;
  onSave: (data: Partial<FormData>) => Promise<unknown>;
}) {
  const [form, setForm] = useState<FormData>({
    name: setting.name,
    description: setting.description,
    content: setting.content,
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
          placeholder="设定名称"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-[var(--text-secondary)]">描述</label>
        <input
          className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm font-[inherit] outline-none focus:border-indigo-500/60 transition-colors w-full"
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="简短说明这个设定何时使用"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-[var(--text-secondary)]">内容</label>
        <textarea
          className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm outline-none focus:border-indigo-500/60 transition-colors w-full resize-none"
          value={form.content}
          onChange={(e) => update("content", e.target.value)}
          placeholder="写入世界观、地点、组织、规则、禁忌、历史事件、人物背景等设定…"
          rows={18}
          style={{ fontFamily: "monospace", fontSize: 13 }}
        />
      </div>

      <div className="pt-2 flex justify-end">
        <button
          className="bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2 rounded-lg text-[13px] cursor-pointer border-none transition-colors disabled:opacity-50"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "保存中…" : "💾 保存"}
        </button>
      </div>
    </div>
  );
}
