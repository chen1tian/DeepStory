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
    <div className="w-full bg-[var(--bg-primary)] px-4 py-2.5 flex flex-wrap gap-2.5 border-t border-[var(--border)] relative z-10 shrink-0 shadow-sm overflow-x-auto minimal-scrollbar">
      {interactables.length > 0 && (
        <div className="flex items-center gap-1.5 flex-nowrap bg-[var(--bg-secondary)] px-2.5 py-1.5 rounded-xl border border-[var(--border)] shadow-inner">
          <span className="text-xs text-amber-500/80 mr-1 whitespace-nowrap font-medium tracking-wide">🔍 物品</span>
          {interactables.map((obj) => (
            <button
              key={obj.name}
              className="px-2.5 py-1 text-[13px] rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/50 hover:shadow-md hover:-translate-y-px transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
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
        <div className="flex items-center gap-1.5 flex-nowrap bg-[var(--bg-secondary)] px-2.5 py-1.5 rounded-xl border border-[var(--border)] shadow-inner">
          <span className="text-xs text-blue-400/80 mr-1 whitespace-nowrap font-medium tracking-wide">💬 NPC</span>
          {npcs.map((npc) => (
            <button
              key={npc.name}
              className={`px-2.5 py-1 text-[13px] rounded-lg border transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap ${
                npc.attitude === "hostile" 
                ? "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 hover:shadow-md hover:-translate-y-px" 
                : "border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/50 hover:shadow-md hover:-translate-y-px"
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
        <div className="flex items-center gap-1.5 flex-nowrap bg-[var(--bg-secondary)] px-2.5 py-1.5 rounded-xl border border-[var(--border)] shadow-inner flex-shrink-0">
          <span className="text-xs text-emerald-400/80 mr-1 whitespace-nowrap font-medium tracking-wide">🚪 探索</span>
          {exits.map((exit) => (
             <button
                key={exit.direction + exit.destination}
                className="px-2.5 py-1 text-[13px] rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 flex items-center gap-1 hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:shadow-md hover:-translate-y-px transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                onClick={() => handleAction(`前往${exit.destination}`)}
                disabled={isStreaming}
                title={exit.note || `${exit.direction} → ${exit.destination}`}
              >
                {exit.destination}
                <span className="text-[11px] opacity-60 ml-0.5">{exit.direction}</span>
              </button>
          ))}
        </div>
      )}
    </div>
  );
}
