import { useState, useRef, useEffect } from "react";
import { useChatStore } from "../stores/chatStore";
import { useConnectionStore } from "../stores/connectionStore";
import { createProtagonistFromRPG } from "../services/api";
import { useProtagonistStore } from "../stores/protagonistStore";
import MapDisplay from "./MapDisplay";
import type { StateData, RPGCharacter } from "../types";

function HealthBar({ current, max, color = "#22c55e" }: { current: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((current / max) * 100) : 0;
  const barColor = pct > 50 ? color : pct > 25 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
      <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: 3, transition: "width 0.3s" }} />
      </div>
      <span style={{ color: "var(--text-secondary)", minWidth: 50, textAlign: "right" }}>{current}/{max}</span>
    </div>
  );
}

function CharacterCard({ char, onSaveToPool }: { char: RPGCharacter; onSaveToPool?: (char: RPGCharacter) => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="state-card" style={{ cursor: "pointer" }} onClick={() => setExpanded(!expanded)}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 600 }}>
          {char.is_protagonist ? "⭐ " : ""}{char.name}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {onSaveToPool && (
            <button
              className="btn-small"
              style={{ fontSize: 11, padding: "1px 6px" }}
              title="保存到角色池"
              onClick={(e) => { e.stopPropagation(); onSaveToPool(char); }}
            >
              💾 入池
            </button>
          )}
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{expanded ? "▲" : "▼"}</span>
        </span>
      </div>
      {char.description && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{char.description}</div>}

      <div style={{ marginTop: 6 }}>
        <div className="label">体力</div>
        <HealthBar current={char.health} max={char.max_health} />
        <div className="label" style={{ marginTop: 4 }}>精力</div>
        <HealthBar current={char.energy} max={char.max_energy} color="#6366f1" />
      </div>

      {char.mood && <div style={{ marginTop: 4, fontSize: 12 }}>情绪: {char.mood}</div>}

      {char.injuries.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div className="label">🩹 伤势</div>
          {char.injuries.map((inj, i) => (
            <span key={i} className="rpg-tag rpg-tag-danger">{inj}</span>
          ))}
        </div>
      )}

      {char.status_effects.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div className="label">⚡ 状态效果</div>
          {char.status_effects.map((eff, i) => (
            <div key={i} className="rpg-tag rpg-tag-warning">
              {eff.name} - {eff.impact}
              {eff.remaining_turns != null && ` (${eff.remaining_turns}回合)`}
            </div>
          ))}
        </div>
      )}

      {expanded && (
        <>
          {char.equipment.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <div className="label">⚔️ 装备</div>
              {char.equipment.map((eq, i) => (
                <div key={i} style={{ fontSize: 12, padding: "2px 0" }}>
                  {eq.name} {eq.bonus && <span style={{ color: "var(--accent)" }}>({eq.bonus})</span>}
                  {eq.durability < 100 && <span style={{ color: "var(--text-secondary)" }}> 耐久{eq.durability}%</span>}
                </div>
              ))}
            </div>
          )}
          {char.skills.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <div className="label">✨ 技能</div>
              {char.skills.map((sk, i) => (
                <div key={i} style={{ fontSize: 12, padding: "2px 0", opacity: sk.available ? 1 : 0.5 }}>
                  {sk.name} Lv.{sk.level}
                  {!sk.available && <span className="rpg-tag rpg-tag-danger">{sk.restriction || "不可用"}</span>}
                </div>
              ))}
            </div>
          )}
          {char.relationships.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <div className="label">🤝 关系</div>
              {char.relationships.map((r, i) => (
                <div key={i} style={{ fontSize: 12, padding: "2px 0" }}>
                  {r.npc}: {r.attitude} {r.note && <span style={{ color: "var(--text-secondary)" }}>({r.note})</span>}
                </div>
              ))}
            </div>
          )}
          {char.tags.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <div className="label">🏷️ 标签</div>
              {char.tags.map((t, i) => <span key={i} className="rpg-tag">{t}</span>)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function StatePanel() {
  const stateData = useChatStore((s) => s.stateData);
  const fetchProtagonists = useProtagonistStore((s) => s.fetchProtagonists);
  const [activeTab, setActiveTab] = useState<"chars" | "inv" | "scene" | "quest" | "log">("chars");
  const [savingName, setSavingName] = useState<string | null>(null);

  const { connections, stateConnectionId, setStateConnectionId } = useConnectionStore();
  const [connDropdownOpen, setConnDropdownOpen] = useState(false);
  const connDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (connDropdownRef.current && !connDropdownRef.current.contains(e.target as Node)) {
        setConnDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const activeStateConn = stateConnectionId
    ? connections.find((c) => c.id === stateConnectionId)
    : null;

  const handleSaveToPool = async (char: RPGCharacter) => {
    setSavingName(char.name);
    try {
      await createProtagonistFromRPG(char);
      await fetchProtagonists();
      alert(`角色 "${char.name}" 已保存到角色池`);
    } catch (e) {
      alert("保存失败: " + (e instanceof Error ? e.message : e));
    } finally {
      setSavingName(null);
    }
  };

  if (!stateData) {
    return (
      <div style={{ padding: 16, color: "var(--text-secondary)", fontSize: 13 }}>
        暂无状态数据，对话开始后将自动提取
      </div>
    );
  }

  const rpg = stateData.rpg;
  const hasRPG = rpg && (rpg.characters.length > 0 || rpg.scene.location || rpg.inventory.length > 0);

  if (!hasRPG) {
    // Legacy display fallback
    return (
      <div>
        <div className="state-section">
          <h3>👥 角色</h3>
          {stateData.characters.map((c, i) => (
            <div className="state-card" key={i}>
              <div style={{ fontWeight: 600 }}>{c.name}</div>
              <div className="label">描述</div><div>{c.description}</div>
              <div className="label">状态</div><div>{c.status}</div>
            </div>
          ))}
        </div>
        <div className="state-section">
          <h3>🌍 世界状态</h3>
          <div className="state-card">
            <div className="label">地点</div><div>{stateData.world_state.location || "未知"}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* State extraction connection selector */}
      <div style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
        <span style={{ color: "var(--text-secondary)", flexShrink: 0 }}>状态连接:</span>
        <div ref={connDropdownRef} style={{ position: "relative", flex: 1 }}>
          <button
            onClick={() => setConnDropdownOpen((o) => !o)}
            style={{
              width: "100%",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "3px 8px",
              fontSize: 12,
              color: activeStateConn ? "var(--text-primary)" : "var(--text-secondary)",
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{activeStateConn ? activeStateConn.name : "跟随对话连接"}</span>
            <span style={{ fontSize: 10 }}>▾</span>
          </button>
          {connDropdownOpen && (
            <div style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              background: "var(--bg-elevated, var(--bg-secondary))",
              border: "1px solid var(--border)",
              borderRadius: 4,
              zIndex: 100,
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              marginTop: 2,
            }}>
              <div
                onClick={() => { setStateConnectionId(null); setConnDropdownOpen(false); }}
                style={{
                  padding: "6px 10px",
                  cursor: "pointer",
                  fontSize: 12,
                  color: !activeStateConn ? "var(--accent)" : "var(--text-secondary)",
                  background: !activeStateConn ? "var(--bg-hover, rgba(255,255,255,0.05))" : "transparent",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover, rgba(255,255,255,0.05))")}
                onMouseLeave={(e) => (e.currentTarget.style.background = !activeStateConn ? "var(--bg-hover, rgba(255,255,255,0.05))" : "transparent")}
              >
                跟随对话连接
              </div>
              {connections.map((c) => (
                <div
                  key={c.id}
                  onClick={() => { setStateConnectionId(c.id); setConnDropdownOpen(false); }}
                  style={{
                    padding: "6px 10px",
                    cursor: "pointer",
                    fontSize: 12,
                    color: stateConnectionId === c.id ? "var(--accent)" : "var(--text-primary)",
                    background: stateConnectionId === c.id ? "var(--bg-hover, rgba(255,255,255,0.05))" : "transparent",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover, rgba(255,255,255,0.05))")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = stateConnectionId === c.id ? "var(--bg-hover, rgba(255,255,255,0.05))" : "transparent")}
                >
                  {c.name}{c.is_default ? " ★" : ""}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="rpg-tabs">
        <button className={activeTab === "chars" ? "active" : ""} onClick={() => setActiveTab("chars")}>👥 角色</button>
        <button className={activeTab === "inv" ? "active" : ""} onClick={() => setActiveTab("inv")}>🎒 背包</button>
        <button className={activeTab === "scene" ? "active" : ""} onClick={() => setActiveTab("scene")}>🗺️ 场景</button>
        <button className={activeTab === "quest" ? "active" : ""} onClick={() => setActiveTab("quest")}>📜 任务</button>
        <button className={activeTab === "log" ? "active" : ""} onClick={() => setActiveTab("log")}>📋 日志</button>
      </div>

      {/* Characters Tab */}
      {activeTab === "chars" && (
        <div className="state-section">
          {rpg.characters.length === 0 && <div className="state-card">暂无角色信息</div>}
          {/* Protagonist first */}
          {rpg.characters.filter(c => c.is_protagonist).map((c, i) => <CharacterCard key={`p${i}`} char={c} onSaveToPool={handleSaveToPool} />)}
          {rpg.characters.filter(c => !c.is_protagonist).map((c, i) => <CharacterCard key={`n${i}`} char={c} onSaveToPool={handleSaveToPool} />)}
        </div>
      )}

      {/* Inventory Tab */}
      {activeTab === "inv" && (
        <div className="state-section">
          {rpg.inventory.length === 0 && <div className="state-card">背包是空的</div>}
          {["key_item", "equipment", "consumable", "material"].map(cat => {
            const items = rpg.inventory.filter(i => i.category === cat);
            if (items.length === 0) return null;
            const labels: Record<string, string> = { key_item: "🔑 关键道具", equipment: "⚔️ 装备", consumable: "🧪 消耗品", material: "📦 材料" };
            return (
              <div key={cat}>
                <div className="label" style={{ marginBottom: 4, marginTop: 8 }}>{labels[cat] || cat}</div>
                {items.map((item, i) => (
                  <div className="state-card" key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{item.name}</div>
                      {item.description && <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{item.description}</div>}
                      {item.effect && <div style={{ fontSize: 11, color: "var(--accent)" }}>{item.effect}</div>}
                    </div>
                    {item.quantity > 1 && <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>×{item.quantity}</span>}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Scene Tab */}
      {activeTab === "scene" && (
        <div className="state-section">
          <div className="state-card">
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              📍 {rpg.scene.location || "未知"}{rpg.scene.sub_location ? ` · ${rpg.scene.sub_location}` : ""}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
              {rpg.scene.time && <span className="rpg-tag">🕐 {rpg.scene.time}</span>}
              {rpg.scene.weather && <span className="rpg-tag">🌤️ {rpg.scene.weather}</span>}
              {rpg.scene.danger_level && <span className={`rpg-tag ${rpg.scene.danger_level === "高" || rpg.scene.danger_level === "极高" ? "rpg-tag-danger" : ""}`}>⚠️ {rpg.scene.danger_level}</span>}
            </div>
            {rpg.scene.atmosphere && <div style={{ marginTop: 6, fontSize: 12, fontStyle: "italic", color: "var(--text-secondary)" }}>{rpg.scene.atmosphere}</div>}
          </div>

          {rpg.scene.npcs.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div className="label">在场人物</div>
              {rpg.scene.npcs.map((n, i) => (
                <div className="state-card" key={i} style={{ fontSize: 13 }}>
                  {n.name} {n.attitude && <span className="rpg-tag">{n.attitude}</span>}
                  {n.status && <span style={{ color: "var(--text-secondary)", fontSize: 11 }}> {n.status}</span>}
                </div>
              ))}
            </div>
          )}

          {rpg.scene.exits.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div className="label">出口 / 通道</div>
              {rpg.scene.exits.map((e, i) => (
                <div className="state-card" key={i} style={{ fontSize: 13, opacity: e.accessible ? 1 : 0.5 }}>
                  {e.direction} → {e.destination} {!e.accessible && <span className="rpg-tag rpg-tag-danger">不可通行</span>}
                  {e.note && <span style={{ color: "var(--text-secondary)", fontSize: 11 }}> ({e.note})</span>}
                </div>
              ))}
            </div>
          )}

          {rpg.scene.objects.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div className="label">可交互物</div>
              {rpg.scene.objects.map((o, i) => (
                <div className="state-card" key={i} style={{ fontSize: 13 }}>
                  {o.name} {o.description && <span style={{ color: "var(--text-secondary)", fontSize: 11 }}> - {o.description}</span>}
                </div>
              ))}
            </div>
          )}

          {rpg.explored_locations.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div className="label">已探索地点 ({rpg.explored_locations.length})</div>
              <MapDisplay
                locations={rpg.explored_locations}
                connections={rpg.region_connections}
                currentLocation={rpg.scene.location}
              />
            </div>
          )}
        </div>
      )}

      {/* Quests Tab */}
      {activeTab === "quest" && (
        <div className="state-section">
          {rpg.quests.length === 0 && <div className="state-card">暂无任务</div>}
          {rpg.quests.filter(q => q.status === "active").map((q, i) => (
            <div className="state-card" key={i}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{q.type === "main" ? "🔥 " : ""}{q.name}</span>
                <span className="rpg-tag">{q.type === "main" ? "主线" : "支线"}</span>
              </div>
              {q.objective && <div style={{ fontSize: 12, marginTop: 4 }}>目标: {q.objective}</div>}
              {q.progress && <div style={{ fontSize: 12, color: "var(--accent)" }}>进度: {q.progress}</div>}
              {q.source_npc && <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>来源: {q.source_npc}</div>}
            </div>
          ))}
          {rpg.quests.filter(q => q.status === "completed").length > 0 && (
            <>
              <div className="label" style={{ marginTop: 8 }}>已完成</div>
              {rpg.quests.filter(q => q.status === "completed").map((q, i) => (
                <div className="state-card" key={i} style={{ opacity: 0.6, fontSize: 12 }}>
                  ✅ {q.name}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Event Log Tab */}
      {activeTab === "log" && (
        <div className="state-section">
          {rpg.event_log.length === 0 && <div className="state-card">暂无事件记录</div>}
          {[...rpg.event_log].reverse().map((evt, i) => (
            <div className="state-card" key={i}>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>
                回合 {evt.turn} {evt.timestamp && `· ${evt.timestamp}`}
              </div>
              <div style={{ fontSize: 13 }}>{evt.description}</div>
              {evt.changes.length > 0 && (
                <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {evt.changes.map((c, j) => <span key={j} className="rpg-tag rpg-tag-warning">{c}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 11, color: "var(--text-secondary)", textAlign: "center", padding: "8px 0" }}>
        回合 {rpg.turn_count} · 版本 {rpg.version}
      </div>
    </div>
  );
}
