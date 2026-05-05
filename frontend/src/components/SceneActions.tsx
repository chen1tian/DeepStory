import { useEffect, useState } from "react";
import { useChatStore } from "../stores/chatStore";

export default function SceneActions() {
  const stateData = useChatStore((s) => s.stateData);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const [activeObjectName, setActiveObjectName] = useState<string | null>(null);
  const [customObjectAction, setCustomObjectAction] = useState("");
  const [isObjectPanelCollapsed, setIsObjectPanelCollapsed] = useState(false);

  const scene = stateData?.rpg?.scene;
  const interactables = (scene?.objects || []).filter((o) => o.interactable);
  const exits = (scene?.exits || []).filter((e) => e.accessible !== false);
  const npcs = (scene?.npcs || []);
  const activeObject = interactables.find((obj) => obj.name === activeObjectName) || null;

  useEffect(() => {
    setActiveObjectName(null);
    setCustomObjectAction("");
  }, [scene?.location, scene?.sub_location]);

  useEffect(() => {
    if (!activeObjectName) return;
    if (!interactables.some((obj) => obj.name === activeObjectName)) {
      setActiveObjectName(null);
      setCustomObjectAction("");
    }
  }, [activeObjectName, interactables]);

  if (!scene || (interactables.length === 0 && exits.length === 0 && npcs.length === 0)) return null;

  const handleAction = (text: string) => {
    if (isStreaming) return;
    setActiveObjectName(null);
    setCustomObjectAction("");
    sendMessage(text);
  };

  const getObjectActions = (obj: { name: string; actions?: string[] }) => {
    const actions = (obj.actions || []).map((action) => action.trim()).filter(Boolean);
    return actions.length > 0
      ? actions
      : [`查看${obj.name}`, `触碰${obj.name}`, `检查${obj.name}周围`];
  };

  const submitCustomObjectAction = () => {
    const text = customObjectAction.trim();
    if (!text || isStreaming) return;
    handleAction(text);
  };

  return (
    <div data-immersive-hide="true" className="w-full bg-[var(--bg-primary)] px-4 py-2.5 flex flex-wrap gap-2.5 border-t border-[var(--border)] relative z-10 shrink-0 shadow-sm overflow-x-auto minimal-scrollbar">
      {interactables.length > 0 && (
        <div className="flex flex-col gap-2 bg-[var(--bg-secondary)] px-2.5 py-1.5 rounded-xl border border-[var(--border)] shadow-inner min-w-0">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs text-amber-500/80 mr-1 whitespace-nowrap font-medium tracking-wide">🔍 物品</span>
              <span className="text-[11px] text-amber-500/60 whitespace-nowrap">{interactables.length} 项</span>
            </div>
            <button
              className="px-2 py-1 text-[11px] rounded-md border border-amber-500/25 bg-amber-500/8 text-amber-300 hover:bg-amber-500/16 hover:border-amber-500/45 transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              onClick={() => setIsObjectPanelCollapsed((current) => !current)}
              disabled={isStreaming}
              title={isObjectPanelCollapsed ? "展开物品栏" : "收起物品栏"}
            >
              {isObjectPanelCollapsed ? "展开" : "收起"}
            </button>
          </div>
          {!isObjectPanelCollapsed && (
            <>
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                {interactables.map((obj) => (
                  <button
                    key={obj.name}
                    className={`px-2.5 py-1 text-[13px] rounded-lg border transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap ${
                      activeObjectName === obj.name
                        ? "border-amber-400/60 bg-amber-500/20 text-amber-300 shadow-md"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/50 hover:shadow-md hover:-translate-y-px"
                    }`}
                    onClick={() => setActiveObjectName((current) => current === obj.name ? null : obj.name)}
                    disabled={isStreaming}
                    title={obj.description || obj.name}
                  >
                    {obj.name}
                  </button>
                ))}
              </div>
              {activeObject && (
                <div className="flex flex-col gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-2 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[12px] text-amber-200 whitespace-nowrap">{activeObject.name}</span>
                    <span className="text-[11px] text-amber-500/70 whitespace-nowrap">选择一个动作</span>
                  </div>
                  {activeObject.description && (
                    <div className="text-[11px] text-[var(--text-secondary)] leading-5">{activeObject.description}</div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {getObjectActions(activeObject).map((action) => (
                      <button
                        key={action}
                        className="px-2.5 py-1 text-[12px] rounded-lg border border-amber-500/30 bg-[var(--bg-primary)] text-amber-300 hover:bg-amber-500/10 hover:border-amber-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        onClick={() => handleAction(action)}
                        disabled={isStreaming}
                        title={action}
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 pt-1 min-w-0">
                    <input
                      className="min-w-0 flex-1 rounded-lg border border-amber-500/25 bg-[var(--bg-primary)] px-3 py-1.5 text-[12px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)] focus:border-amber-500/50"
                      value={customObjectAction}
                      onChange={(e) => setCustomObjectAction(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          submitCustomObjectAction();
                        }
                      }}
                      placeholder={`自定义动作，例如：揭下${activeObject.name}`}
                      disabled={isStreaming}
                    />
                    <button
                      className="px-2.5 py-1.5 text-[12px] rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                      onClick={submitCustomObjectAction}
                      disabled={isStreaming || !customObjectAction.trim()}
                      title="发送自定义动作"
                    >
                      自定义动作
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
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
