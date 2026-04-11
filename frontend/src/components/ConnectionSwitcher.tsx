import { useEffect, useState } from "react";
import { useConnectionStore } from "../stores/connectionStore";

export default function ConnectionSwitcher() {
  const [open, setOpen] = useState(false);
  const { connections, activeConnectionId, fetchConnections, setActiveConnectionId } = useConnectionStore();

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const activeConnection = connections.find((c) => c.id === activeConnectionId) || connections[0];

  const handleSelect = (id: string) => {
    setActiveConnectionId(id);
    setOpen(false);
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1 bg-transparent text-gray-400 hover:text-gray-200 hover:bg-[var(--bg-tertiary)]"
        onClick={() => setOpen(!open)}
      >
        🔗 {activeConnection ? activeConnection.name : "选择连接"} ▾
      </button>

      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 40 }}
            onClick={() => setOpen(false)}
          />
          <div
            className="dropdown-menu shadow-xl border border-gray-700 max-h-[300px] overflow-y-auto"
            style={{
              position: "absolute",
              top: "100%",
              right: 0,
              marginTop: 4,
              backgroundColor: "var(--bg-secondary)",
              borderRadius: 8,
              minWidth: 200,
              zIndex: 50,
            }}
          >
            {connections.length === 0 ? (
              <div className="p-3 text-sm text-gray-500">暂无连接，请先创建</div>
            ) : (
              connections.map((c) => (
                <div
                  key={c.id}
                  className={`px-4 py-2 text-sm cursor-pointer hover:bg-[var(--bg-tertiary)] flex items-center justify-between ${
                    c.id === activeConnectionId ? "text-cyan-400 bg-[var(--bg-tertiary)]" : "text-gray-300"
                  }`}
                  onClick={() => handleSelect(c.id)}
                >
                  <span className="truncate">{c.name}</span>
                  {c.is_default && (
                    <span className="text-[10px] bg-gray-700 px-1 rounded">默认</span>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
