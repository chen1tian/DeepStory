import { useEffect, useState } from "react";
import { usePresetStore } from "../stores/presetStore";
import { useSessionStore } from "../stores/sessionStore";
import { updateSessionSystemPrompt } from "../services/api";

interface Props {
  sessionId: string;
}

export default function PresetSwitcher({ sessionId }: Props) {
  const { presets, fetchPresets } = usePresetStore();
  const sessions = useSessionStore((s) => s.sessions);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  const currentSession = sessions.find((s) => s.id === sessionId);
  // Use session's preset_id, or fall back to default preset for old sessions
  const currentPresetId = currentSession?.preset_id
    || presets.find((p) => p.is_default)?.id
    || "";

  const handleSwitch = async (presetId: string) => {
    if (!presetId || presetId === currentPresetId) return;
    setApplying(true);
    try {
      await updateSessionSystemPrompt(sessionId, { preset_id: presetId });
      // Update local session data
      useSessionStore.getState().updateSessionPreset(sessionId, presetId);
    } finally {
      setApplying(false);
    }
  };

  if (presets.length === 0) return null;

  return (
    <div className="flex items-center">
      <select
        className="bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] rounded-md px-2.5 py-1.5 text-[13px] outline-none cursor-pointer disabled:opacity-50"
        value={currentPresetId}
        onChange={(e) => handleSwitch(e.target.value)}
        disabled={applying}
        title="切换预设（立即对后续消息生效）"
      >
        <option value="" disabled>
          📝 切换预设
        </option>
        {presets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}{p.is_default ? " ★" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
