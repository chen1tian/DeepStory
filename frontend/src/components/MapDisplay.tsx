import { useMemo, useCallback } from "react";
import type { MapLocation } from "../types";

interface MapDisplayProps {
  locations: MapLocation[];
  connections: Record<string, string[]>;
  currentLocation: string;
}

interface NodePos {
  name: string;
  x: number;
  y: number;
  isCurrent: boolean;
  notes: string;
}

const SVG_CX = 160;
const SVG_CY = 130;
const RING_RADII = [0, 75, 145, 205];

function computeLayout(
  locations: MapLocation[],
  connections: Record<string, string[]>,
  currentLocation: string,
): NodePos[] {
  const names = locations.map((l) => l.name);
  const nameSet = new Set(names);
  const notesMap = Object.fromEntries(locations.map((l) => [l.name, l.notes]));

  // Build adjacency map (only between explored nodes)
  const adj: Record<string, string[]> = {};
  for (const name of names) {
    adj[name] = [];
  }
  for (const [from, tos] of Object.entries(connections)) {
    if (!nameSet.has(from)) continue;
    for (const to of tos) {
      if (!nameSet.has(to)) continue;
      if (!adj[from].includes(to)) adj[from].push(to);
      if (!adj[to]) adj[to] = [];
      if (!adj[to].includes(from)) adj[to].push(from);
    }
  }

  // BFS from currentLocation to assign rings
  const ringOf: Record<string, number> = {};
  const order: string[] = [];

  const startNode = nameSet.has(currentLocation) ? currentLocation : names[0];
  if (!startNode) return [];

  const queue: string[] = [startNode];
  ringOf[startNode] = 0;

  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);
    const neighbors = adj[node] ?? [];
    for (const nb of neighbors) {
      if (ringOf[nb] === undefined) {
        ringOf[nb] = Math.min(ringOf[node] + 1, RING_RADII.length - 1);
        queue.push(nb);
      }
    }
  }

  // Assign remaining nodes (disconnected) to last ring
  for (const name of names) {
    if (ringOf[name] === undefined) {
      ringOf[name] = RING_RADII.length - 1;
      order.push(name);
    }
  }

  // Group by ring
  const rings: Record<number, string[]> = { 0: [], 1: [], 2: [], 3: [] };
  for (const name of order) {
    const ring = ringOf[name] ?? RING_RADII.length - 1;
    rings[ring].push(name);
  }

  // Compute positions
  const positions: NodePos[] = [];

  for (let ringIdx = 0; ringIdx <= RING_RADII.length - 1; ringIdx++) {
    const ring = rings[ringIdx];
    if (!ring || ring.length === 0) continue;
    const r = RING_RADII[ringIdx];

    if (ringIdx === 0) {
      // Center node
      positions.push({
        name: ring[0],
        x: SVG_CX,
        y: SVG_CY,
        isCurrent: ring[0] === currentLocation,
        notes: notesMap[ring[0]] ?? "",
      });
    } else {
      const angleStep = (2 * Math.PI) / ring.length;
      // Offset start angle per ring to avoid straight-line stacking
      const startAngle = ringIdx % 2 === 0 ? Math.PI / 4 : -Math.PI / 6;
      ring.forEach((name, i) => {
        const angle = startAngle + i * angleStep;
        positions.push({
          name,
          x: SVG_CX + r * Math.cos(angle),
          y: SVG_CY + r * Math.sin(angle),
          isCurrent: name === currentLocation,
          notes: notesMap[name] ?? "",
        });
      });
    }
  }

  return positions;
}

function injectToInput(text: string) {
  const textarea = document.querySelector<HTMLTextAreaElement>("textarea[placeholder*='创作']");
  if (textarea) {
    const nativeInputSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    nativeInputSetter?.call(textarea, text);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.focus();
  }
}

export default function MapDisplay({ locations, connections, currentLocation }: MapDisplayProps) {
  const nodes = useMemo(
    () => computeLayout(locations, connections, currentLocation),
    [locations, connections, currentLocation],
  );

  // Build edge list (de-duplicated)
  const edges = useMemo(() => {
    const seen = new Set<string>();
    const result: [string, string][] = [];
    const nameSet = new Set(locations.map((l) => l.name));

    for (const [from, tos] of Object.entries(connections)) {
      if (!nameSet.has(from)) continue;
      for (const to of tos) {
        if (!nameSet.has(to)) continue;
        const key = [from, to].sort().join("||");
        if (!seen.has(key)) {
          seen.add(key);
          result.push([from, to]);
        }
      }
    }
    return result;
  }, [locations, connections]);

  const posMap = useMemo(
    () => Object.fromEntries(nodes.map((n) => [n.name, n])),
    [nodes],
  );

  const handleNodeClick = useCallback(
    (node: NodePos) => {
      if (node.isCurrent) return;
      injectToInput(`前往${node.name}。`);
    },
    [],
  );

  if (nodes.length === 0) return null;

  // SVG height adapts to max ring used
  const maxRadius = nodes.reduce((m, n) => {
    const dx = n.x - SVG_CX;
    const dy = n.y - SVG_CY;
    return Math.max(m, Math.sqrt(dx * dx + dy * dy));
  }, 0);
  const svgHeight = Math.max(220, Math.ceil(SVG_CY + maxRadius + 30));
  const svgWidth = Math.max(260, Math.ceil(SVG_CX + maxRadius + 30));

  return (
    <div
      style={{
        width: "100%",
        overflowX: "auto",
        marginTop: 4,
        background: "var(--bg-secondary)",
        borderRadius: 8,
        border: "1px solid var(--border)",
      }}
    >
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        width="100%"
        style={{ display: "block", minWidth: 220, maxHeight: 280 }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Edges */}
        {edges.map(([from, to]) => {
          const a = posMap[from];
          const b = posMap[to];
          if (!a || !b) return null;
          return (
            <line
              key={`${from}||${to}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="var(--border, #334155)"
              strokeWidth={1.5}
              opacity={0.6}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const r = node.isCurrent ? 18 : 14;
          const fill = node.isCurrent ? "#0f2744" : "var(--bg-primary, #1e293b)";
          const stroke = node.isCurrent ? "#38bdf8" : "var(--border, #334155)";
          const strokeWidth = node.isCurrent ? 2.5 : 1.5;
          const labelColor = node.isCurrent ? "#38bdf8" : "var(--text-primary, #e2e8f0)";
          const cursor = node.isCurrent ? "default" : "pointer";
          const label = node.name.length > 7 ? node.name.slice(0, 6) + "…" : node.name;

          return (
            <g
              key={node.name}
              onClick={() => handleNodeClick(node)}
              style={{ cursor }}
            >
              <title>
                {node.name}
                {node.notes ? `\n${node.notes}` : ""}
                {!node.isCurrent ? "\n点击预填前往指令" : "\n（当前位置）"}
              </title>
              {/* Glow for current */}
              {node.isCurrent && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={r + 6}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth={1}
                  opacity={0.2}
                />
              )}
              <circle
                cx={node.x}
                cy={node.y}
                r={r}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
              />
              {node.isCurrent && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={5}
                  fill="#38bdf8"
                  opacity={0.9}
                />
              )}
              <text
                x={node.x}
                y={node.y + r + 11}
                textAnchor="middle"
                fontSize={10}
                fill={labelColor}
                fontFamily="inherit"
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
      <div
        style={{
          fontSize: 10,
          color: "var(--text-secondary)",
          textAlign: "center",
          padding: "3px 0 5px",
          opacity: 0.7,
        }}
      >
        🗺️ 点击地点可预填前往指令 · 当前: {currentLocation || "未知"}
      </div>
    </div>
  );
}
