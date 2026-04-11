import { create } from "zustand";
import type { Connection, CreateConnectionRequest, UpdateConnectionRequest } from "../types";
import {
  getConnections,
  createConnection,
  updateConnection,
  deleteConnection,
} from "../services/api";

interface ConnectionState {
  connections: Connection[];
  activeConnectionId: string | null;
  stateConnectionId: string | null;
  loading: boolean;

  fetchConnections: () => Promise<void>;
  addConnection: (data?: CreateConnectionRequest) => Promise<Connection>;
  editConnection: (id: string, data: UpdateConnectionRequest) => Promise<Connection>;
  removeConnection: (id: string) => Promise<void>;
  setActiveConnectionId: (id: string | null) => void;
  setStateConnectionId: (id: string | null) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  connections: [],
  activeConnectionId: localStorage.getItem("activeConnectionId") || null,
  stateConnectionId: localStorage.getItem("stateConnectionId") || null,
  loading: false,

  fetchConnections: async () => {
    set({ loading: true });
    try {
      const connections = await getConnections();
      
      let active = localStorage.getItem("activeConnectionId") || null;
      if (connections.length > 0) {
        if (!active || !connections.find(c => c.id === active)) {
          const def = connections.find(c => c.is_default);
          active = def ? def.id : connections[0].id;
          localStorage.setItem("activeConnectionId", active);
        }
      }
      
      set({ connections, activeConnectionId: active, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  addConnection: async (data?: CreateConnectionRequest) => {
    const c = await createConnection(data || { name: "新连接" });
    set((s) => ({ connections: [c, ...s.connections] }));
    return c;
  },

  editConnection: async (id: string, data: UpdateConnectionRequest) => {
    const updated = await updateConnection(id, data);
    set((s) => ({
      connections: s.connections.map((c) => (c.id === id ? updated : c)),
    }));
    return updated;
  },

  removeConnection: async (id: string) => {
    await deleteConnection(id);
    set((s) => {
      const newConnections = s.connections.filter((c) => c.id !== id);
      let newActive = s.activeConnectionId;
      if (newActive === id) {
        const def = newConnections.find(c => c.is_default);
        newActive = def ? def.id : (newConnections.length > 0 ? newConnections[0].id : null);
        if (newActive) {
            localStorage.setItem("activeConnectionId", newActive);
        } else {
            localStorage.removeItem("activeConnectionId");
        }
      }
      return { connections: newConnections, activeConnectionId: newActive };
    });
  },

  setActiveConnectionId: (id: string | null) => {
    if (id) {
      localStorage.setItem("activeConnectionId", id);
    } else {
      localStorage.removeItem("activeConnectionId");
    }
    set({ activeConnectionId: id });
  },

  setStateConnectionId: (id: string | null) => {
    if (id) {
      localStorage.setItem("stateConnectionId", id);
    } else {
      localStorage.removeItem("stateConnectionId");
    }
    set({ stateConnectionId: id });
  },
}));
