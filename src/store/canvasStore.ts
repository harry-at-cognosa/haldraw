import { create } from 'zustand';
import type {
  Board,
  BoardSnapshot,
  CanvasEdge,
  CanvasNode,
  EdgeRouting,
  EdgeStyle,
  NodeStyle,
  NodeType,
  Viewport,
} from '@shared/types';
import { newId } from '@/util/id';

export type Tool =
  | 'select'
  | 'rect'
  | 'square'
  | 'ellipse'
  | 'diamond'
  | 'line'
  | 'arrow'
  | 'text'
  | 'connector'
  | 'icon'
  | 'image'
  | 'pan';

export type SnapshotDelta = {
  upsertNodes: CanvasNode[];
  deleteNodeIds: string[];
  upsertEdges: CanvasEdge[];
  deleteEdgeIds: string[];
};

interface HistoryEntry {
  nodes: Record<string, CanvasNode>;
  edges: Record<string, CanvasEdge>;
}

interface CanvasState {
  boardId: string | null;
  board: Board | null;
  nodes: Record<string, CanvasNode>;
  edges: Record<string, CanvasEdge>;
  selection: Set<string>;
  edgeSelection: Set<string>;
  tool: Tool;
  viewport: Viewport;
  history: HistoryEntry[];
  future: HistoryEntry[];
  dirtyNodeIds: Set<string>;
  dirtyEdgeIds: Set<string>;
  deletedNodeIds: Set<string>;
  deletedEdgeIds: Set<string>;
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  transientChange: boolean;
  editingNodeId: string | null;
  lastNodeStyle: Partial<Record<NodeType, NodeStyle>>;
  lastEdge: {
    style: EdgeStyle;
    routing: EdgeRouting;
    arrowStart: boolean;
    arrowEnd: boolean;
  };
  setEditingNodeId: (id: string | null) => void;

  hydrate: (s: BoardSnapshot) => void;
  clear: () => void;
  setBoardBackground: (bg: string) => void;
  setTool: (t: Tool) => void;
  setViewport: (v: Viewport) => void;
  panBy: (dx: number, dy: number) => void;
  zoomAt: (clientX: number, clientY: number, delta: number) => void;

  select: (ids: string[], opts?: { additive?: boolean; edges?: boolean }) => void;
  clearSelection: () => void;

  addNode: (partial: Omit<CanvasNode, 'id' | 'boardId' | 'createdAt' | 'updatedAt' | 'zIndex' | 'groupId'> & { zIndex?: number; groupId?: string | null }) => CanvasNode;
  updateNodes: (ids: string[], updater: (n: CanvasNode) => CanvasNode | void) => void;
  deleteNodes: (ids: string[]) => void;

  addEdge: (partial: Omit<CanvasEdge, 'id' | 'boardId' | 'createdAt' | 'updatedAt' | 'midpoint' | 'labelPoint'> & { midpoint?: { x: number; y: number } | null; labelPoint?: { x: number; y: number } | null }) => CanvasEdge;
  updateEdges: (ids: string[], updater: (e: CanvasEdge) => CanvasEdge | void) => void;
  deleteEdges: (ids: string[]) => void;

  beginTransient: () => void;
  endTransient: () => void;
  commit: () => void;
  undo: () => void;
  redo: () => void;

  bringToFront: (ids: string[]) => void;
  sendToBack: (ids: string[]) => void;
  bringForward: (ids: string[]) => void;
  sendBackward: (ids: string[]) => void;

  groupSelection: () => void;
  ungroupSelection: () => void;
  expandSelectionToGroups: (ids: string[]) => string[];

  alignSelection: (mode: 'left' | 'center-h' | 'right' | 'top' | 'middle' | 'bottom') => void;
  distributeSelection: (axis: 'h' | 'v') => void;

  rememberNodeStyle: (type: NodeType, style: NodeStyle) => void;
  rememberEdgeAttrs: (patch: Partial<CanvasState['lastEdge']>) => void;
  resetNodeStyle: (ids: string[]) => void;
  resetLastNodeStyle: (type: NodeType) => void;

  toggleGrid: () => void;
  toggleSnap: () => void;

  consumeDirty: () => {
    upserts: CanvasNode[];
    deletions: string[];
    edgeUpserts: CanvasEdge[];
    edgeDeletions: string[];
  };
}

function snapshot(state: CanvasState): HistoryEntry {
  return { nodes: { ...state.nodes }, edges: { ...state.edges } };
}

function maxZIndex(nodes: Record<string, CanvasNode>): number {
  let m = 0;
  for (const n of Object.values(nodes)) if (n.zIndex > m) m = n.zIndex;
  return m;
}

function minZIndex(nodes: Record<string, CanvasNode>): number {
  let m = Infinity;
  for (const n of Object.values(nodes)) if (n.zIndex < m) m = n.zIndex;
  if (!isFinite(m)) m = 0;
  return m;
}

const HISTORY_LIMIT = 200;

export const useCanvas = create<CanvasState>((set, get) => ({
  boardId: null,
  board: null,
  nodes: {},
  edges: {},
  selection: new Set(),
  edgeSelection: new Set(),
  tool: 'select',
  viewport: { x: 0, y: 0, zoom: 1 },
  history: [],
  future: [],
  dirtyNodeIds: new Set(),
  dirtyEdgeIds: new Set(),
  deletedNodeIds: new Set(),
  deletedEdgeIds: new Set(),
  showGrid: true,
  snapToGrid: false,
  gridSize: 10,
  transientChange: false,
  editingNodeId: null,
  lastNodeStyle: {},
  lastEdge: {
    style: { stroke: '#0b0d10', strokeWidth: 2, opacity: 1 },
    routing: 'straight',
    arrowStart: false,
    arrowEnd: true,
  },

  hydrate: (s) => {
    const nodes: Record<string, CanvasNode> = {};
    const edges: Record<string, CanvasEdge> = {};
    for (const n of s.nodes) nodes[n.id] = n;
    for (const e of s.edges) edges[e.id] = e;
    set({
      boardId: s.board.id,
      board: s.board,
      nodes,
      edges,
      viewport: s.board.viewport,
      selection: new Set(),
      edgeSelection: new Set(),
      history: [],
      future: [],
      dirtyNodeIds: new Set(),
      dirtyEdgeIds: new Set(),
      deletedNodeIds: new Set(),
      deletedEdgeIds: new Set(),
    });
  },

  setBoardBackground: (bg: string) => {
    set((s) => (s.board ? { board: { ...s.board, background: bg } } : {}));
  },

  clear: () =>
    set({
      boardId: null,
      board: null,
      nodes: {},
      edges: {},
      selection: new Set(),
      edgeSelection: new Set(),
      history: [],
      future: [],
    }),

  setTool: (tool) => set({ tool }),

  setEditingNodeId: (id) => set({ editingNodeId: id }),

  setViewport: (v) => set({ viewport: v }),

  panBy: (dx, dy) =>
    set((s) => ({ viewport: { ...s.viewport, x: s.viewport.x + dx, y: s.viewport.y + dy } })),

  zoomAt: (clientX, clientY, delta) =>
    set((s) => {
      const newZoom = Math.min(8, Math.max(0.05, s.viewport.zoom * (1 + delta)));
      const ratio = newZoom / s.viewport.zoom;
      const x = clientX - (clientX - s.viewport.x) * ratio;
      const y = clientY - (clientY - s.viewport.y) * ratio;
      return { viewport: { x, y, zoom: newZoom } };
    }),

  select: (ids, opts) =>
    set((s) => {
      const field = opts?.edges ? 'edgeSelection' : 'selection';
      const other = opts?.edges ? 'selection' : 'edgeSelection';
      const next = new Set(opts?.additive ? s[field] : []);
      for (const id of ids) {
        if (opts?.additive && next.has(id)) next.delete(id);
        else next.add(id);
      }
      return { [field]: next, [other]: opts?.additive ? s[other] : new Set() } as Partial<CanvasState>;
    }),

  clearSelection: () => set({ selection: new Set(), edgeSelection: new Set() }),

  addNode: (partial) => {
    const now = Date.now();
    const zIndex = partial.zIndex ?? maxZIndex(get().nodes) + 1;
    const node: CanvasNode = {
      id: newId(),
      boardId: get().boardId!,
      createdAt: now,
      updatedAt: now,
      zIndex,
      groupId: null,
      ...partial,
    };
    const prev = snapshot(get());
    set((s) => ({
      nodes: { ...s.nodes, [node.id]: node },
      history: [...s.history.slice(-HISTORY_LIMIT + 1), prev],
      future: [],
      dirtyNodeIds: new Set(s.dirtyNodeIds).add(node.id),
    }));
    return node;
  },

  updateNodes: (ids, updater) => {
    set((s) => {
      const nodes = { ...s.nodes };
      const dirty = new Set(s.dirtyNodeIds);
      const now = Date.now();
      for (const id of ids) {
        const existing = nodes[id];
        if (!existing) continue;
        const draft: CanvasNode = { ...existing };
        const result = updater(draft);
        const next = (result ?? draft) as CanvasNode;
        next.updatedAt = now;
        nodes[id] = next;
        dirty.add(id);
      }
      return { nodes, dirtyNodeIds: dirty };
    });
  },

  deleteNodes: (ids) => {
    const prev = snapshot(get());
    set((s) => {
      const nodes = { ...s.nodes };
      const edges = { ...s.edges };
      const deletedNodes = new Set(s.deletedNodeIds);
      const deletedEdges = new Set(s.deletedEdgeIds);
      const selection = new Set(s.selection);
      for (const id of ids) {
        if (nodes[id]) {
          delete nodes[id];
          deletedNodes.add(id);
          selection.delete(id);
        }
        for (const e of Object.values(edges)) {
          if (e.fromNode === id || e.toNode === id) {
            delete edges[e.id];
            deletedEdges.add(e.id);
          }
        }
      }
      return {
        nodes,
        edges,
        selection,
        deletedNodeIds: deletedNodes,
        deletedEdgeIds: deletedEdges,
        history: [...s.history.slice(-HISTORY_LIMIT + 1), prev],
        future: [],
      };
    });
  },

  addEdge: (partial) => {
    const now = Date.now();
    const edge: CanvasEdge = {
      id: newId(),
      boardId: get().boardId!,
      createdAt: now,
      updatedAt: now,
      midpoint: null,
      labelPoint: null,
      ...partial,
    };
    const prev = snapshot(get());
    set((s) => ({
      edges: { ...s.edges, [edge.id]: edge },
      history: [...s.history.slice(-HISTORY_LIMIT + 1), prev],
      future: [],
      dirtyEdgeIds: new Set(s.dirtyEdgeIds).add(edge.id),
    }));
    return edge;
  },

  updateEdges: (ids, updater) => {
    set((s) => {
      const edges = { ...s.edges };
      const dirty = new Set(s.dirtyEdgeIds);
      const now = Date.now();
      for (const id of ids) {
        const existing = edges[id];
        if (!existing) continue;
        const draft: CanvasEdge = { ...existing };
        const result = updater(draft);
        const next = (result ?? draft) as CanvasEdge;
        next.updatedAt = now;
        edges[id] = next;
        dirty.add(id);
      }
      return { edges, dirtyEdgeIds: dirty };
    });
  },

  deleteEdges: (ids) => {
    const prev = snapshot(get());
    set((s) => {
      const edges = { ...s.edges };
      const deletedEdges = new Set(s.deletedEdgeIds);
      const edgeSel = new Set(s.edgeSelection);
      for (const id of ids) {
        if (edges[id]) {
          delete edges[id];
          deletedEdges.add(id);
          edgeSel.delete(id);
        }
      }
      return {
        edges,
        edgeSelection: edgeSel,
        deletedEdgeIds: deletedEdges,
        history: [...s.history.slice(-HISTORY_LIMIT + 1), prev],
        future: [],
      };
    });
  },

  beginTransient: () => {
    const prev = snapshot(get());
    set((s) => ({ history: [...s.history.slice(-HISTORY_LIMIT + 1), prev], transientChange: true }));
  },

  endTransient: () => set({ transientChange: false, future: [] }),

  commit: () => {
    const prev = snapshot(get());
    set((s) => ({ history: [...s.history.slice(-HISTORY_LIMIT + 1), prev], future: [] }));
  },

  undo: () => {
    const s = get();
    const last = s.history[s.history.length - 1];
    if (!last) return;
    const current = snapshot(s);
    const prevNodeIds = new Set(Object.keys(last.nodes));
    const prevEdgeIds = new Set(Object.keys(last.edges));
    const dirtyN = new Set(s.dirtyNodeIds);
    const dirtyE = new Set(s.dirtyEdgeIds);
    const delN = new Set(s.deletedNodeIds);
    const delE = new Set(s.deletedEdgeIds);
    for (const id of prevNodeIds) dirtyN.add(id);
    for (const id of Object.keys(s.nodes)) if (!prevNodeIds.has(id)) delN.add(id);
    for (const id of prevEdgeIds) dirtyE.add(id);
    for (const id of Object.keys(s.edges)) if (!prevEdgeIds.has(id)) delE.add(id);
    set({
      nodes: { ...last.nodes },
      edges: { ...last.edges },
      history: s.history.slice(0, -1),
      future: [...s.future, current],
      dirtyNodeIds: dirtyN,
      dirtyEdgeIds: dirtyE,
      deletedNodeIds: delN,
      deletedEdgeIds: delE,
      selection: new Set(),
      edgeSelection: new Set(),
    });
  },

  redo: () => {
    const s = get();
    const next = s.future[s.future.length - 1];
    if (!next) return;
    const current = snapshot(s);
    const dirtyN = new Set(s.dirtyNodeIds);
    const dirtyE = new Set(s.dirtyEdgeIds);
    const delN = new Set(s.deletedNodeIds);
    const delE = new Set(s.deletedEdgeIds);
    for (const id of Object.keys(next.nodes)) dirtyN.add(id);
    for (const id of Object.keys(s.nodes)) if (!next.nodes[id]) delN.add(id);
    for (const id of Object.keys(next.edges)) dirtyE.add(id);
    for (const id of Object.keys(s.edges)) if (!next.edges[id]) delE.add(id);
    set({
      nodes: { ...next.nodes },
      edges: { ...next.edges },
      history: [...s.history, current],
      future: s.future.slice(0, -1),
      dirtyNodeIds: dirtyN,
      dirtyEdgeIds: dirtyE,
      deletedNodeIds: delN,
      deletedEdgeIds: delE,
      selection: new Set(),
      edgeSelection: new Set(),
    });
  },

  bringToFront: (ids) => {
    const prev = snapshot(get());
    set((s) => {
      const top = maxZIndex(s.nodes);
      const nodes = { ...s.nodes };
      const dirty = new Set(s.dirtyNodeIds);
      let z = top + 1;
      for (const id of ids) {
        if (!nodes[id]) continue;
        nodes[id] = { ...nodes[id], zIndex: z++, updatedAt: Date.now() };
        dirty.add(id);
      }
      return {
        nodes,
        dirtyNodeIds: dirty,
        history: [...s.history.slice(-HISTORY_LIMIT + 1), prev],
        future: [],
      };
    });
  },
  sendToBack: (ids) => {
    const prev = snapshot(get());
    set((s) => {
      const bottom = minZIndex(s.nodes);
      const nodes = { ...s.nodes };
      const dirty = new Set(s.dirtyNodeIds);
      let z = bottom - ids.length;
      for (const id of ids) {
        if (!nodes[id]) continue;
        nodes[id] = { ...nodes[id], zIndex: z++, updatedAt: Date.now() };
        dirty.add(id);
      }
      return {
        nodes,
        dirtyNodeIds: dirty,
        history: [...s.history.slice(-HISTORY_LIMIT + 1), prev],
        future: [],
      };
    });
  },
  bringForward: (ids) => {
    const prev = snapshot(get());
    set((s) => {
      const nodes = { ...s.nodes };
      const dirty = new Set(s.dirtyNodeIds);
      for (const id of ids) {
        if (!nodes[id]) continue;
        nodes[id] = { ...nodes[id], zIndex: nodes[id].zIndex + 1, updatedAt: Date.now() };
        dirty.add(id);
      }
      return {
        nodes,
        dirtyNodeIds: dirty,
        history: [...s.history.slice(-HISTORY_LIMIT + 1), prev],
        future: [],
      };
    });
  },
  sendBackward: (ids) => {
    const prev = snapshot(get());
    set((s) => {
      const nodes = { ...s.nodes };
      const dirty = new Set(s.dirtyNodeIds);
      for (const id of ids) {
        if (!nodes[id]) continue;
        nodes[id] = { ...nodes[id], zIndex: nodes[id].zIndex - 1, updatedAt: Date.now() };
        dirty.add(id);
      }
      return {
        nodes,
        dirtyNodeIds: dirty,
        history: [...s.history.slice(-HISTORY_LIMIT + 1), prev],
        future: [],
      };
    });
  },

  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleSnap: () => set((s) => ({ snapToGrid: !s.snapToGrid })),

  groupSelection: () => {
    const ids = [...get().selection];
    if (ids.length < 2) return;
    const prev = snapshot(get());
    const groupId = newId();
    set((s) => {
      const nodes = { ...s.nodes };
      const dirty = new Set(s.dirtyNodeIds);
      const now = Date.now();
      for (const id of ids) {
        if (!nodes[id]) continue;
        nodes[id] = { ...nodes[id], groupId, updatedAt: now };
        dirty.add(id);
      }
      return {
        nodes,
        dirtyNodeIds: dirty,
        history: [...s.history.slice(-HISTORY_LIMIT + 1), prev],
        future: [],
      };
    });
  },

  ungroupSelection: () => {
    const ids = [...get().selection];
    if (!ids.length) return;
    const prev = snapshot(get());
    set((s) => {
      const nodes = { ...s.nodes };
      const dirty = new Set(s.dirtyNodeIds);
      const now = Date.now();
      const groupsToClear = new Set<string>();
      for (const id of ids) {
        const n = nodes[id];
        if (n?.groupId) groupsToClear.add(n.groupId);
      }
      for (const n of Object.values(nodes)) {
        if (n.groupId && groupsToClear.has(n.groupId)) {
          nodes[n.id] = { ...n, groupId: null, updatedAt: now };
          dirty.add(n.id);
        }
      }
      return {
        nodes,
        dirtyNodeIds: dirty,
        history: [...s.history.slice(-HISTORY_LIMIT + 1), prev],
        future: [],
      };
    });
  },

  alignSelection: (mode) => {
    const s = get();
    const ids = [...s.selection];
    if (ids.length < 2) return;
    const nodes = ids.map((id) => s.nodes[id]).filter(Boolean);
    if (nodes.length < 2) return;
    const minX = Math.min(...nodes.map((n) => n.x));
    const maxX = Math.max(...nodes.map((n) => n.x + n.width));
    const minY = Math.min(...nodes.map((n) => n.y));
    const maxY = Math.max(...nodes.map((n) => n.y + n.height));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const prev = snapshot(s);
    set((st) => {
      const out = { ...st.nodes };
      const dirty = new Set(st.dirtyNodeIds);
      const now = Date.now();
      for (const id of ids) {
        const n = out[id];
        if (!n) continue;
        let x = n.x;
        let y = n.y;
        if (mode === 'left') x = minX;
        else if (mode === 'right') x = maxX - n.width;
        else if (mode === 'center-h') x = cx - n.width / 2;
        else if (mode === 'top') y = minY;
        else if (mode === 'bottom') y = maxY - n.height;
        else if (mode === 'middle') y = cy - n.height / 2;
        out[id] = { ...n, x, y, updatedAt: now };
        dirty.add(id);
      }
      return {
        nodes: out,
        dirtyNodeIds: dirty,
        history: [...st.history.slice(-HISTORY_LIMIT + 1), prev],
        future: [],
      };
    });
  },

  rememberNodeStyle: (type, style) => {
    set((s) => ({ lastNodeStyle: { ...s.lastNodeStyle, [type]: { ...style } } }));
  },

  rememberEdgeAttrs: (patch) => {
    set((s) => ({
      lastEdge: {
        style: patch.style ? { ...s.lastEdge.style, ...patch.style } : s.lastEdge.style,
        routing: patch.routing ?? s.lastEdge.routing,
        arrowStart: patch.arrowStart ?? s.lastEdge.arrowStart,
        arrowEnd: patch.arrowEnd ?? s.lastEdge.arrowEnd,
      },
    }));
  },

  resetNodeStyle: (ids) => {
    if (!ids.length) return;
    const prev = snapshot(get());
    set((s) => {
      const nodes = { ...s.nodes };
      const dirty = new Set(s.dirtyNodeIds);
      const now = Date.now();
      const lastCopy = { ...s.lastNodeStyle };
      for (const id of ids) {
        const n = nodes[id];
        if (!n) continue;
        nodes[id] = { ...n, style: { ...DEFAULT_NODE_STYLE }, updatedAt: now };
        dirty.add(id);
        delete lastCopy[n.type];
      }
      return {
        nodes,
        dirtyNodeIds: dirty,
        lastNodeStyle: lastCopy,
        history: [...s.history.slice(-HISTORY_LIMIT + 1), prev],
        future: [],
      };
    });
  },

  resetLastNodeStyle: (type) => {
    set((s) => {
      const copy = { ...s.lastNodeStyle };
      delete copy[type];
      return { lastNodeStyle: copy };
    });
  },

  distributeSelection: (axis) => {
    const s = get();
    const ids = [...s.selection];
    if (ids.length < 3) return;
    const nodes = ids.map((id) => s.nodes[id]).filter(Boolean);
    if (nodes.length < 3) return;
    const sorted = [...nodes].sort((a, b) => (axis === 'h' ? a.x - b.x : a.y - b.y));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const firstCenter = axis === 'h' ? first.x + first.width / 2 : first.y + first.height / 2;
    const lastCenter = axis === 'h' ? last.x + last.width / 2 : last.y + last.height / 2;
    const step = (lastCenter - firstCenter) / (sorted.length - 1);
    const prev = snapshot(s);
    set((st) => {
      const out = { ...st.nodes };
      const dirty = new Set(st.dirtyNodeIds);
      const now = Date.now();
      sorted.forEach((n, i) => {
        if (i === 0 || i === sorted.length - 1) return;
        const targetCenter = firstCenter + step * i;
        const curr = { ...n };
        if (axis === 'h') curr.x = targetCenter - curr.width / 2;
        else curr.y = targetCenter - curr.height / 2;
        curr.updatedAt = now;
        out[n.id] = curr;
        dirty.add(n.id);
      });
      return {
        nodes: out,
        dirtyNodeIds: dirty,
        history: [...st.history.slice(-HISTORY_LIMIT + 1), prev],
        future: [],
      };
    });
  },

  expandSelectionToGroups: (ids) => {
    const s = get();
    const groupIds = new Set<string>();
    for (const id of ids) {
      const gid = s.nodes[id]?.groupId;
      if (gid) groupIds.add(gid);
    }
    const out = new Set(ids);
    if (groupIds.size) {
      for (const n of Object.values(s.nodes)) {
        if (n.groupId && groupIds.has(n.groupId)) out.add(n.id);
      }
    }
    return [...out];
  },

  consumeDirty: () => {
    const s = get();
    const upserts: CanvasNode[] = [];
    for (const id of s.dirtyNodeIds) {
      const n = s.nodes[id];
      if (n) upserts.push(n);
    }
    const edgeUpserts: CanvasEdge[] = [];
    for (const id of s.dirtyEdgeIds) {
      const e = s.edges[id];
      if (e) edgeUpserts.push(e);
    }
    const deletions = [...s.deletedNodeIds];
    const edgeDeletions = [...s.deletedEdgeIds];
    set({
      dirtyNodeIds: new Set(),
      dirtyEdgeIds: new Set(),
      deletedNodeIds: new Set(),
      deletedEdgeIds: new Set(),
    });
    return { upserts, deletions, edgeUpserts, edgeDeletions };
  },
}));

export const DEFAULT_NODE_STYLE: NodeStyle = {
  fill: '#1f2937',
  stroke: '#e6e8eb',
  strokeWidth: 2,
  opacity: 1,
  fontSize: 16,
  fontFamily: 'Inter, system-ui, sans-serif',
  fontWeight: 500,
  color: '#e6e8eb',
  textAlign: 'center',
  cornerRadius: 8,
};

export const DEFAULT_EDGE_ROUTING: EdgeRouting = 'straight';
