import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useChatStore } from "../stores/chatStore";
import { useSessionStore } from "../stores/sessionStore";
import { useConnectionStore } from "../stores/connectionStore";

interface MapData {
  ascii_map: string | null;
  cache_key: string | null;
}

// ── ASCII art renderer with clickable location tokens ─────────────────────────

function AsciiMapContent({
  ascii,
  onGoto,
}: {
  ascii: string;
  onGoto: (name: string) => void;
}) {
  // Split on: ◆[name] (exit), ★[name] (current location), or [name] (other location)
  const tokens = ascii.split(/([◆★]?\[[^\]]+\])/g);

  return (
    <pre
      style={{
        fontFamily: "'Courier New', 'Noto Sans SC', monospace",
        fontSize: 11,
        lineHeight: 1.5,
        margin: 0,
        whiteSpace: "pre",
        overflowX: "auto",
        color: "var(--text-primary, #e2e8f0)",
      }}
    >
      {tokens.map((token, i) => {
        const isExit = token.startsWith("◆[") && token.endsWith("]");
        const isCurrent = token.startsWith("★[") && token.endsWith("]");
        const isLocation = !isExit && !isCurrent && token.startsWith("[") && token.endsWith("]");

        if (isExit) {
          const name = token.slice(2, -1);
          return (
            <span
              key={i}
              onClick={() => onGoto(name)}
              style={{
                color: "#f59e0b",
                cursor: "pointer",
                fontWeight: "bold",
              }}
              title={`出口通往: ${name}（点击前往）`}
            >
              {token}
            </span>
          );
        }

        if (isCurrent) {
          const name = token.slice(2, -1);
          return (
            <span
              key={i}
              style={{
                color: "#38bdf8",
                fontWeight: "bold",
                textShadow: "0 0 8px rgba(56,189,248,0.6)",
              }}
              title={`当前位置: ${name}`}
            >
              {token}
            </span>
          );
        }

        if (isLocation) {
          const name = token.slice(1, -1);
          return (
            <span
              key={i}
              onClick={() => onGoto(name)}
              style={{
                color: "#a78bfa",
                cursor: "pointer",
                textDecoration: "underline",
                textDecorationStyle: "dotted",
              }}
              title={`点击前往 ${name}`}
            >
              {token}
            </span>
          );
        }

        return <span key={i}>{token}</span>;
      })}
    </pre>
  );
}

// ── Inject text into the main chat textarea ───────────────────────────────────

function injectToInput(text: string) {
  const textarea = document.querySelector<HTMLTextAreaElement>(
    "textarea[placeholder*='创作']",
  );
  if (textarea) {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    setter?.call(textarea, text);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.focus();
  }
}

// ── Main overlay component ────────────────────────────────────────────────────

export default function MapOverlay() {
  const currentSessionId = useSessionStore((s) => s.currentSessionId);
  const stateData = useChatStore((s) => s.stateData);
  const stateConnectionId = useConnectionStore((s) => s.stateConnectionId);

  const [collapsed, setCollapsed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastWorldRef = useRef<string>("");
  const lastLocationRef = useRef<string>("");
  const lastSessionRef = useRef<string>("");

  const rpg = stateData?.rpg;

  // World signature: explored + connections. When this changes, LLM may regenerate.
  const worldSignature = useMemo(() => {
    if (!rpg?.scene?.location) return "";
    const explored = (rpg.explored_locations ?? [])
      .map((l) => l.name)
      .sort()
      .join(",");
    const conns = JSON.stringify(
      rpg.region_connections ?? {},
      Object.keys(rpg.region_connections ?? {}).sort(),
    );
    return `${explored}|${conns}`;
  }, [rpg]);

  const currentLocation = rpg?.scene?.location ?? "";

  const handleGoto = useCallback((name: string) => {
    injectToInput(`前往${name}。`);
  }, []);

  useEffect(() => {
    if (!currentSessionId || !currentLocation) return;

    // On session switch, clear stale map immediately
    if (currentSessionId !== lastSessionRef.current) {
      lastSessionRef.current = currentSessionId;
      lastWorldRef.current = "";
      lastLocationRef.current = "";
      setMapData(null);
      setError(null);
    }

    // Skip if neither world state nor location changed
    if (worldSignature === lastWorldRef.current && currentLocation === lastLocationRef.current) return;
    lastWorldRef.current = worldSignature;
    lastLocationRef.current = currentLocation;

    const explored = (rpg?.explored_locations ?? []).map((l) => l.name);
    const connections = rpg?.region_connections ?? {};

    setGenerating(true);
    setError(null);

    fetch(`/api/sessions/${currentSessionId}/map/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(localStorage.getItem("auth_token")
          ? { Authorization: `Bearer ${localStorage.getItem("auth_token")}` }
          : {}),
      },
      body: JSON.stringify({
        location: currentLocation,
        connections,
        explored_locations: explored,
        connection_id: stateConnectionId ?? null,
      }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<MapData>;
      })
      .then((data) => {
        setMapData(data);
        setError(null);
      })
      .catch((e: Error) => {
        setError(e.message);
      })
      .finally(() => setGenerating(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldSignature, currentLocation, currentSessionId]);

  if (!currentSessionId || !currentLocation) return null;

  const panelWidth = fullscreen ? "min(92vw, 500px)" : 300;
  const panelMaxH = fullscreen ? "88vh" : 280;

  return (
    <div
      data-immersive-hide="true"
      style={{
        position: "fixed",
        bottom: fullscreen ? "50%" : 20,
        right: fullscreen ? "50%" : 20,
        transform: fullscreen ? "translate(50%, 50%)" : "none",
        zIndex: fullscreen ? 50 : 40,
        width: panelWidth,
        background: "var(--bg-secondary, #1e293b)",
        border: "1px solid var(--border, #334155)",
        borderRadius: 10,
        boxShadow: "0 8px 28px rgba(0,0,0,0.45)",
        overflow: "hidden",
        fontFamily: "inherit",
        userSelect: "none",
        transition: "width 0.2s, max-height 0.2s",
      }}
    >
      {/* Header / toggle bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 10px",
          background: "var(--bg-tertiary, #0f172a)",
          borderBottom: collapsed ? "none" : "1px solid var(--border, #334155)",
          cursor: "pointer",
        }}
      >
        <span
          onClick={() => setCollapsed((c) => !c)}
          style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary, #e2e8f0)", flex: 1 }}
        >
          🗺️ 地图{generating ? " …" : ""}
        </span>
        <span style={{ fontSize: 10, color: "var(--text-secondary, #94a3b8)", marginRight: 8 }}>
          {currentLocation}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); setFullscreen((f) => !f); }}
          title={fullscreen ? "退出全屏" : "全屏查看"}
          style={{
            background: "none",
            border: "1px solid var(--border, #334155)",
            borderRadius: 4,
            color: "var(--text-secondary, #94a3b8)",
            cursor: "pointer",
            fontSize: 12,
            padding: "1px 6px",
            marginRight: 4,
          }}
        >
          {fullscreen ? "⤢" : "⤡"}
        </button>
        <span
          onClick={() => setCollapsed((c) => !c)}
          style={{ fontSize: 10, color: "var(--text-secondary, #94a3b8)", cursor: "pointer" }}
        >
          {collapsed ? "▲" : "▼"}
        </span>
      </div>

      {/* Body */}
      {!collapsed && (
        <div style={{ padding: "8px 10px", maxHeight: panelMaxH, overflowY: "auto", overflowX: "hidden" }}>
          {generating && !mapData?.ascii_map && (
            <div
              style={{
                fontSize: 11,
                color: "var(--text-secondary, #94a3b8)",
                textAlign: "center",
                padding: "14px 0",
              }}
            >
              正在生成地图…
            </div>
          )}

          {error && !mapData?.ascii_map && (
            <div style={{ fontSize: 11, color: "#f87171", padding: "4px 0" }}>
              地图生成失败: {error}
            </div>
          )}

          {mapData?.ascii_map && (
            <AsciiMapContent ascii={mapData.ascii_map} onGoto={handleGoto} />
          )}

          {mapData?.ascii_map && (
            <div
              style={{
                marginTop: 5,
                fontSize: 10,
                color: "var(--text-secondary, #64748b)",
                textAlign: "center",
              }}
            >
              点击金色◆出口或紫色地点可预填前往指令
            </div>
          )}
        </div>
      )}
    </div>
  );
}



