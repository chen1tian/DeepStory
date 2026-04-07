import { useEffect, useState } from "react";
import { usePresetStore } from "../stores/presetStore";
import { updateSessionSystemPrompt } from "../services/api";

interface Props {
  sessionId: string;
}

export default function PresetSwitcher({ sessionId }: Props) {
  const { presets, fetchPresets } = usePresetStore();
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  const handleSwitch = async (presetId: string) => {
    if (!presetId) return;
    setApplying(true);
    try {
      await updateSessionSystemPrompt(sessionId, { preset_id: presetId });
    } finally {
      setApplying(false);
    }
  };

  if (presets.length === 0) return null;

  return (
    <div className="preset-switcher">
      <select
        onChange={(e) => handleSwitch(e.target.value)}
        defaultValue=""
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
