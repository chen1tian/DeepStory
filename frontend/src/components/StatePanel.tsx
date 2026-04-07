import { useChatStore } from "../stores/chatStore";
import type { StateData } from "../types";

export default function StatePanel() {
  const stateData = useChatStore((s) => s.stateData);

  if (!stateData) {
    return (
      <div style={{ padding: 16, color: "var(--text-secondary)", fontSize: 13 }}>
        暂无状态数据，对话开始后将自动提取
      </div>
    );
  }

  return (
    <div>
      {/* Characters */}
      <div className="state-section">
        <h3>👥 角色</h3>
        {stateData.characters.length === 0 && (
          <div className="state-card">暂无角色信息</div>
        )}
        {stateData.characters.map((c, i) => (
          <div className="state-card" key={i}>
            <div style={{ fontWeight: 600 }}>{c.name}</div>
            <div className="label">描述</div>
            <div>{c.description}</div>
            <div className="label">状态</div>
            <div>{c.status}</div>
          </div>
        ))}
      </div>

      {/* Events */}
      <div className="state-section">
        <h3>📋 事件</h3>
        {stateData.events.length === 0 && (
          <div className="state-card">暂无事件记录</div>
        )}
        {stateData.events.map((e, i) => (
          <div className="state-card" key={i}>
            <div>{e.description}</div>
            <div className="label">{e.timestamp}</div>
          </div>
        ))}
      </div>

      {/* World State */}
      <div className="state-section">
        <h3>🌍 世界状态</h3>
        <div className="state-card">
          <div className="label">地点</div>
          <div>{stateData.world_state.location || "未知"}</div>
        </div>
        <div className="state-card">
          <div className="label">时间</div>
          <div>{stateData.world_state.time || "未知"}</div>
        </div>
        <div className="state-card">
          <div className="label">氛围</div>
          <div>{stateData.world_state.atmosphere || "未知"}</div>
        </div>
        {stateData.world_state.key_items.length > 0 && (
          <div className="state-card">
            <div className="label">关键物品</div>
            <div>{stateData.world_state.key_items.join("、")}</div>
          </div>
        )}
      </div>

      <div style={{ fontSize: 11, color: "var(--text-secondary)", textAlign: "center" }}>
        版本 {stateData.version}
      </div>
    </div>
  );
}
