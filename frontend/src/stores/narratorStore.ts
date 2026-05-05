import { create } from "zustand";
import type {
  NarratorArc,
  NarratorArcCollection,
  NarrativeDirective,
  StoryNode,
  NarratorEvaluation,
  NarratorUpdatePayload,
  CreateArcRequest,
  UpdateArcRequest,
  CreateNodeRequest,
  UpdateNodeRequest,
  CreateDirectiveRequest,
  GenerateNodesRequest,
} from "../types";
import * as api from "../services/api";

interface NarratorState {
  arc: NarratorArc | null;
  archivedArcs: NarratorArc[];
  lastUpdate: NarratorUpdatePayload | null;
  isGenerating: boolean;
  error: string | null;

  // Actions
  loadArc: (sessionId: string) => Promise<void>;
  createArc: (sessionId: string, data: CreateArcRequest) => Promise<void>;
  updateArc: (sessionId: string, data: UpdateArcRequest) => Promise<void>;
  deleteArc: (sessionId: string) => Promise<void>;
  toggleEnabled: (sessionId: string) => Promise<void>;

  addNode: (sessionId: string, data: CreateNodeRequest) => Promise<void>;
  updateNode: (sessionId: string, nodeId: string, data: UpdateNodeRequest) => Promise<void>;
  removeNode: (sessionId: string, nodeId: string) => Promise<void>;
  generateNodes: (sessionId: string, request: GenerateNodesRequest) => Promise<StoryNode[]>;

  addDirective: (sessionId: string, data: CreateDirectiveRequest) => Promise<void>;
  removeDirective: (sessionId: string, directiveId: string) => Promise<void>;

  /** Called by chatStore when a narrator_update WS message arrives */
  handleNarratorUpdate: (sessionId: string, payload: NarratorUpdatePayload) => void;

  clearError: () => void;
}

function applyArcCollection(collection: NarratorArcCollection) {
  return {
    arc: collection.current_arc,
    archivedArcs: collection.archived_arcs,
    error: null,
  };
}

export const useNarratorStore = create<NarratorState>((set, get) => ({
  arc: null,
  archivedArcs: [],
  lastUpdate: null,
  isGenerating: false,
  error: null,

  loadArc: async (sessionId) => {
    try {
      const collection = await api.getArc(sessionId);
      set(applyArcCollection(collection));
    } catch {
      set({ arc: null, archivedArcs: [] });
    }
  },

  createArc: async (sessionId, data) => {
    try {
      const collection = await api.createArc(sessionId, data);
      set(applyArcCollection(collection));
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e) });
      throw e;
    }
  },

  updateArc: async (sessionId, data) => {
    try {
      const collection = await api.updateArc(sessionId, data);
      set(applyArcCollection(collection));
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : String(e) });
      throw e;
    }
  },

  deleteArc: async (sessionId) => {
    await api.deleteArc(sessionId);
    set((s) => ({ arc: null, archivedArcs: s.archivedArcs, lastUpdate: null }));
  },

  toggleEnabled: async (sessionId) => {
    const collection = await api.toggleArc(sessionId);
    set(applyArcCollection(collection));
  },

  addNode: async (sessionId, data) => {
    const node = await api.addNode(sessionId, data);
    set((s) => {
      if (!s.arc) return {};
      const nodes = [...s.arc.nodes, node].sort((a, b) => a.order - b.order);
      return { arc: { ...s.arc, nodes } };
    });
  },

  updateNode: async (sessionId, nodeId, data) => {
    const updated = await api.updateNode(sessionId, nodeId, data);
    set((s) => {
      if (!s.arc) return {};
      const nodes = s.arc.nodes
        .map((n) => (n.id === nodeId ? updated : n))
        .sort((a, b) => a.order - b.order);
      return { arc: { ...s.arc, nodes } };
    });
  },

  removeNode: async (sessionId, nodeId) => {
    await api.deleteNode(sessionId, nodeId);
    set((s) => {
      if (!s.arc) return {};
      return { arc: { ...s.arc, nodes: s.arc.nodes.filter((n) => n.id !== nodeId) } };
    });
  },

  generateNodes: async (sessionId, request) => {
    set({ isGenerating: true });
    try {
      const { nodes } = await api.generateNodes(sessionId, request);
      return nodes;
    } finally {
      set({ isGenerating: false });
    }
  },

  addDirective: async (sessionId, data) => {
    const directive = await api.addDirective(sessionId, data);
    set((s) => {
      if (!s.arc) return {};
      return { arc: { ...s.arc, active_directives: [...s.arc.active_directives, directive] } };
    });
  },

  removeDirective: async (sessionId, directiveId) => {
    await api.deleteDirective(sessionId, directiveId);
    set((s) => {
      if (!s.arc) return {};
      return {
        arc: {
          ...s.arc,
          active_directives: s.arc.active_directives.filter((d) => d.id !== directiveId),
        },
      };
    });
  },

  handleNarratorUpdate: (sessionId, payload) => {
    set((s) => {
      if (!s.arc || s.arc.session_id !== sessionId) return { lastUpdate: payload };
      // Apply node status changes locally
      const updatedNodes = s.arc.nodes.map((node) => {
        const change = payload.node_changes.find((c) => c.node_id === node.id);
        return change ? { ...node, status: change.new_status } : node;
      });
      return {
        lastUpdate: payload,
        arc: {
          ...s.arc,
          tension_level: payload.tension_level,
          nodes: updatedNodes,
        },
      };
    });
  },

  clearError: () => set({ error: null }),
}));
