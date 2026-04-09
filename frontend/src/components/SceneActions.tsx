import { useChatStore } from "../stores/chatStore";

export default function SceneActions() {
  const stateData = useChatStore((s) => s.stateData);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const isStreaming = useChatStore((s) => s.isStreaming);

  const scene = stateData?.rpg?.scene;
  if (!scene) return null;

  const interactables = (scene.objects || []).filter((o) => o.interactable);
  const exits = (scene.exits || []).filter((e) => e.accessible !== false);
  const npcs = (scene.npcs || []);

  if (interactables.length === 0 && exits.length === 0 && npcs.length === 0) return null;

  const handleAction = (text: string) => {
    if (isStreaming) return;
    sendMessage(text);
  };

  return (
    <div className="scene-actions">
      {interactables.length > 0 && (
        <div className="scene-action-group">
          <span className="scene-action-label">🔍 物品</span>
          {interactables.map((obj) => (
            <button
              key={obj.name}
              className="scene-action-btn scene-action-object"
              onClick={() => handleAction(`查看${obj.name}`)}
              disabled={isStreaming}
              title={obj.description || obj.name}
            >
              {obj.name}
            </button>
          ))}
        </div>
      )}
      {npcs.length > 0 && (
        <div className="scene-action-group">
          <span className="scene-action-label">💬 NPC</span>
          {npcs.map((npc) => (
            <button
              key={npc.name}
              className={`scene-action-btn scene-action-npc ${
                npc.attitude === "hostile" ? "hostile" : ""
              }`}
              onClick={() => handleAction(`与${npc.name}交谈`)}
              disabled={isStreaming}
              title={`${npc.name}${npc.status ? ` - ${npc.status}` : ""}`}
            >
              {npc.name}
            </button>
          ))}
        </div>
      )}
      {exits.length > 0 && (
        <div className="scene-action-group">
          <span className="scene-action-label">🚪 前往</span>
          {exits.map((exit) => (
            <button
              key={exit.direction + exit.destination}
              className="scene-action-btn scene-action-exit"
              onClick={() => handleAction(`前往${exit.destination}`)}
              disabled={isStreaming}
              title={exit.note || `${exit.direction} → ${exit.destination}`}
            >
              {exit.destination}
              <span className="exit-dir">{exit.direction}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
