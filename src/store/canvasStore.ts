import { create } from 'zustand';
import type {
  Board,
  BoardSnapshot,
  CanvasEdge,
  CanvasNode,
  EdgeRouting,
  EdgeStyle,
  Layer,
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

/** Transient canvas-only view of locked reference nodes. Never persisted, never exported. */
export type RefView = 'normal' | 'hidden' | 'only';

export type SnapshotDelta = {
  upsertNodes: CanvasNode[];
  deleteNodeIds: string[];
  upsertEdges: CanvasEdge[];
  deleteEdgeIds: string[];
};

interface HistoryEntry {
  nodes: Record<string, CanvasNode>;
  edges: Record<string, CanvasEdge>;
  layers: Record<string, Layer>;
}

interface CanvasState {
  boardId: string | null;
  board: Board | null;
  nodes: Record<string, CanvasNode>;
  edges: Record<string, CanvasEdge>;
  layers: Record<string, Layer>;
  /** Layer new nodes land in. Persisted on the board. */
  currentLayerId: string | null;
  /** Transient: when set, only this layer is shown. */
  soloLayerId: string | null;
  dirtyLayerIds: Set<string>;
  deletedLayerIds: Set<string>;
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
  refView: RefView;
  setRefView: (v: RefView) => void;
  /** Session-only: include locked reference images in PNG/SVG export. Default off. */
  exportIncludeRefs: boolean;
  setExportIncludeRefs: (v: boolean) => void;
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
  setBoardDimReferences: (dim: boolean) => void;
  setTool: (t: Tool) => void;
  setViewport: (v: Viewport) => void;
  panBy: (dx: number, dy: number) => void;
  zoomAt: (clientX: number, clientY: number, delta: number) => void;

  select: (ids: string[], opts?: { additive?: boolean; edges?: boolean }) => void;
  clearSelection: () => void;

  addNode: (partial: Omit<CanvasNode, 'id' | 'boardId' | 'createdAt' | 'updatedAt' | 'zIndex' | 'groupId' | 'locked' | 'layerId'> & { zIndex?: number; groupId?: string | null; locked?: boolean; layerId?: string }) => CanvasNode;
  /** Lock (reference layer) or unlock nodes. Locking drops them from the selection. */
  setLocked: (ids: string[], locked: boolean) => void;
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

  // ---- layers ----
  addLayer: (opts?: { name?: string; locked?: boolean; atBottom?: boolean; makeCurrent?: boolean }) => Layer;
  renameLayer: (id: string, name: string) => void;
  setLayerVisible: (id: string, visible: boolean) => void;
  setLayerLocked: (id: string, locked: boolean) => void;
  /** Swap with the neighbour above ('up') or below ('down'). */
  moveLayer: (id: string, dir: 'up' | 'down') => void;
  /** Refuses to delete the last layer. 'merge' moves the layer's nodes to the neighbour below (or above for the bottom layer). */
  deleteLayer: (id: string, mode: 'delete' | 'merge') => boolean;
  setCurrentLayer: (id: string) => void;
  setSoloLayer: (id: string | null) => void;
  moveNodesToLayer: (ids: string[], layerId: string) => void;
  /** Move the selection one layer up or down. */
  shiftSelectionLayer: (dir: 'up' | 'down') => void;

  consumeDirty: () => {
    upserts: CanvasNode[];
    deletions: string[];
    edgeUpserts: CanvasEdge[];
    edgeDeletions: string[];
    layerUpserts: Layer[];
    layerDeletions: string[];
  };
}

function snapshot(state: CanvasState): HistoryEntry {
  return { nodes: { ...state.nodes }, edges: { ...state.edges }, layers: { ...state.layers } };
}

/** Layers bottom-first. */
export function layerOrder(layers: Record<string, Layer>): Layer[] {
  return Object.values(layers).sort((a, b) => a.position - b.position || a.createdAt - b.createdAt);
}

/** Visible on the canvas: layer shown, and not excluded by solo. */
export function isNodeVisible(s: Pick<CanvasState, 'layers' | 'soloLayerId'>, n: CanvasNode): boolean {
  const l = s.layers[n.layerId];
  if (l && !l.visible) return false;
  if (s.soloLayerId && n.layerId !== s.soloLayerId) return false;
  return true;
}

/** Responds to the pointer: visible, and neither the node nor its layer is locked. */
export function isNodeInteractive(s: Pick<CanvasState, 'layers' | 'soloLayerId'>, n: CanvasNode): boolean {
  if (!isNodeVisible(s, n)) return false;
  if (n.locked) return false;
  const l = s.layers[n.layerId];
  return !(l && l.locked);
}

function renumberLayers(layers: Record<string, Layer>): Record<string, Layer> {
  const out: Record<string, Layer> = {};
  layerOrder(layers).forEach((l, i) => {
    out[l.id] = l.position === i ? l : { ...l, position: i };
  });
  return out;
}

function maxZIndex(nodes: Record<string, CanvasNode>): number {
  let m = 0;
  for (const n of Object.values(nodes)) if (n.zIndex > m) m = n.zIndex;
  return m;
}

/**
 * Move each selected node one step in the stack by swapping z with the nearest
 * unselected neighbour in that direction. Selected nodes are processed from the
 * leading edge so a contiguous selection moves as a block.
 */
function swapWithNeighbour(
  get: () => CanvasState,
  set: (partial: Partial<CanvasState> | ((s: CanvasState) => Partial<CanvasState>)) => void,
  ids: string[],
  dir: 'up' | 'down'
) {
  const prev = snapshot(get());
  set((s) => {
    const nodes = { ...s.nodes };
    const dirty = new Set(s.dirtyNodeIds);
    const selected = new Set(ids.filter((id) => nodes[id]));
    if (!selected.size) return {};
    const order = Object.values(nodes).sort((a, b) => a.zIndex - b.zIndex);
    const idx = new Map(order.map((n, i) => [n.id, i]));
    const moving = [...selected].sort((a, b) =>
      dir === 'up' ? idx.get(b)! - idx.get(a)! : idx.get(a)! - idx.get(b)!
    );
    const now = Date.now();
    for (const id of moving) {
      const i = order.findIndex((n) => n.id === id);
      const j = dir === 'up' ? i + 1 : i - 1;
      if (j < 0 || j >= order.length) continue;
      const other = order[j];
      if (selected.has(other.id)) continue;
      const a = nodes[id];
      const b = nodes[other.id];
      nodes[id] = { ...a, zIndex: b.zIndex, updatedAt: now };
      nodes[other.id] = { ...b, zIndex: a.zIndex, updatedAt: now };
      dirty.add(id);
      dirty.add(other.id);
      order[i] = nodes[other.id];
      order[j] = nodes[id];
    }
    return {
      nodes,
      dirtyNodeIds: dirty,
      history: [...s.history.slice(-HISTORY_LIMIT + 1), prev],
      future: [],
    };
  });
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
  layers: {},
  currentLayerId: null,
  soloLayerId: null,
  dirtyLayerIds: new Set(),
  deletedLayerIds: new Set(),
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
  exportIncludeRefs: false,
  setExportIncludeRefs: (v) => set({ exportIncludeRefs: v }),
  refView: 'normal',
  setRefView: (v) =>
    set((s) => ({
      refView: v,
      // Nodes hidden by the view must not stay selected.
      selection: v === 'normal' ? s.selection : new Set<string>(),
      edgeSelection: v === 'normal' ? s.edgeSelection : new Set<string>(),
    })),
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
    // Renumber z-indices densely (0..n-1) in current visual order so that
    // Bring forward / Send backward can swap with a true neighbour and ties
    // never survive a load. Only nodes whose value changes are marked dirty.
    const ordered = [...s.nodes].sort((a, b) => a.zIndex - b.zIndex || a.createdAt - b.createdAt);
    const dirty = new Set<string>();
    ordered.forEach((n, i) => {
      if (n.zIndex !== i) {
        nodes[n.id] = { ...n, zIndex: i };
        dirty.add(n.id);
      } else {
        nodes[n.id] = n;
      }
    });
    for (const e of s.edges) edges[e.id] = e;
    const layers: Record<string, Layer> = {};
    for (const l of s.layers) layers[l.id] = l;
    const bottom = layerOrder(layers)[0];
    // Safety net: a node with no layer (should not happen after migration) goes to the bottom layer.
    if (bottom) {
      for (const n of Object.values(nodes)) {
        if (!n.layerId || !layers[n.layerId]) {
          nodes[n.id] = { ...n, layerId: bottom.id };
          dirty.add(n.id);
        }
      }
    }
    const currentLayerId =
      s.board.currentLayerId && layers[s.board.currentLayerId] ? s.board.currentLayerId : bottom?.id ?? null;
    set({
      boardId: s.board.id,
      board: s.board,
      nodes,
      edges,
      layers,
      currentLayerId,
      soloLayerId: null,
      dirtyLayerIds: new Set(),
      deletedLayerIds: new Set(),
      viewport: s.board.viewport,
      refView: 'normal',
      selection: new Set(),
      edgeSelection: new Set(),
      history: [],
      future: [],
      dirtyNodeIds: dirty,
      dirtyEdgeIds: new Set(),
      deletedNodeIds: new Set(),
      deletedEdgeIds: new Set(),
    });
  },

  setBoardDimReferences: (dim) => {
    set((s) => (s.board ? { board: { ...s.board, dimReferences: dim } } : {}));
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
      layers: {},
      currentLayerId: null,
      soloLayerId: null,
      dirtyLayerIds: new Set(),
      deletedLayerIds: new Set(),
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
      const patch = { [field]: next, [other]: opts?.additive ? s[other] : new Set() } as Partial<CanvasState>;
      if (!opts?.edges) {
        const firstId = ids.find((id) => next.has(id));
        const n = firstId ? s.nodes[firstId] : undefined;
        if (n && n.layerId && s.layers[n.layerId] && n.layerId !== s.currentLayerId) {
          patch.currentLayerId = n.layerId;
        }
      }
      return patch;
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
      locked: false,
      layerId: get().currentLayerId ?? '',
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

  setLocked: (ids, locked) => {
    const prev = snapshot(get());
    set((s) => {
      const nodes = { ...s.nodes };
      const dirty = new Set(s.dirtyNodeIds);
      const selection = new Set(s.selection);
      const now = Date.now();
      for (const id of ids) {
        if (!nodes[id]) continue;
        nodes[id] = { ...nodes[id], locked, updatedAt: now };
        dirty.add(id);
        if (locked) selection.delete(id);
      }
      return {
        nodes,
        dirtyNodeIds: dirty,
        selection,
        history: [...s.history.slice(-HISTORY_LIMIT + 1), prev],
        future: [],
      };
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
    const dirtyL = new Set(s.dirtyLayerIds);
    const delL = new Set(s.deletedLayerIds);
    for (const id of Object.keys(last.layers)) dirtyL.add(id);
    for (const id of Object.keys(s.layers)) if (!last.layers[id]) delL.add(id);
    set({
      nodes: { ...last.nodes },
      edges: { ...last.edges },
      layers: { ...last.layers },
      currentLayerId: s.currentLayerId && last.layers[s.currentLayerId] ? s.currentLayerId : layerOrder(last.layers)[0]?.id ?? null,
      history: s.history.slice(0, -1),
      future: [...s.future, current],
      dirtyNodeIds: dirtyN,
      dirtyEdgeIds: dirtyE,
      deletedNodeIds: delN,
      deletedEdgeIds: delE,
      dirtyLayerIds: dirtyL,
      deletedLayerIds: delL,
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
    const dirtyL = new Set(s.dirtyLayerIds);
    const delL = new Set(s.deletedLayerIds);
    for (const id of Object.keys(next.layers)) dirtyL.add(id);
    for (const id of Object.keys(s.layers)) if (!next.layers[id]) delL.add(id);
    set({
      nodes: { ...next.nodes },
      edges: { ...next.edges },
      layers: { ...next.layers },
      currentLayerId: s.currentLayerId && next.layers[s.currentLayerId] ? s.currentLayerId : layerOrder(next.layers)[0]?.id ?? null,
      history: [...s.history, current],
      future: s.future.slice(0, -1),
      dirtyNodeIds: dirtyN,
      dirtyEdgeIds: dirtyE,
      deletedNodeIds: delN,
      deletedEdgeIds: delE,
      dirtyLayerIds: dirtyL,
      deletedLayerIds: delL,
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
  bringForward: (ids) => swapWithNeighbour(get, set, ids, 'up'),
  sendBackward: (ids) => swapWithNeighbour(get, set, ids, 'down'),

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

  addLayer: (opts) => {
    const s = get();
    const prev = snapshot(s);
    const now = Date.now();
    const ordered = layerOrder(s.layers);
    const existingNames = new Set(ordered.map((l) => l.name));
    let name = opts?.name ?? `Layer ${ordered.length + 1}`;
    let k = ordered.length + 1;
    while (existingNames.has(name)) name = `Layer ${++k}`;
    const layer: Layer = {
      id: newId(),
      boardId: s.boardId!,
      name,
      position: opts?.atBottom ? -1 : ordered.length,
      visible: true,
      locked: Boolean(opts?.locked),
      createdAt: now,
      updatedAt: now,
    };
    const layers = renumberLayers({ ...s.layers, [layer.id]: layer });
    const dirty = new Set(s.dirtyLayerIds);
    for (const l of Object.values(layers)) if (l !== s.layers[l.id]) dirty.add(l.id);
    set({
      layers,
      dirtyLayerIds: dirty,
      currentLayerId: opts?.makeCurrent === false ? s.currentLayerId : layer.id,
      history: [...s.history.slice(-HISTORY_LIMIT + 1), prev],
      future: [],
    });
    return layers[layer.id];
  },

  renameLayer: (id, name) => {
    const s = get();
    if (!s.layers[id] || !name.trim()) return;
    const prev = snapshot(s);
    set({
      layers: { ...s.layers, [id]: { ...s.layers[id], name: name.trim(), updatedAt: Date.now() } },
      dirtyLayerIds: new Set(s.dirtyLayerIds).add(id),
      history: [...s.history.slice(-HISTORY_LIMIT + 1), prev],
      future: [],
    });
  },

  setLayerVisible: (id, visible) => {
    const s = get();
    if (!s.layers[id]) return;
    const prev = snapshot(s);
    const selection = new Set(s.selection);
    if (!visible) for (const nid of selection) if (s.nodes[nid]?.layerId === id) selection.delete(nid);
    set({
      layers: { ...s.layers, [id]: { ...s.layers[id], visible, updatedAt: Date.now() } },
      dirtyLayerIds: new Set(s.dirtyLayerIds).add(id),
      selection,
      history: [...s.history.slice(-HISTORY_LIMIT + 1), prev],
      future: [],
    });
  },

  setLayerLocked: (id, locked) => {
    const s = get();
    if (!s.layers[id]) return;
    const prev = snapshot(s);
    const selection = new Set(s.selection);
    if (locked) for (const nid of selection) if (s.nodes[nid]?.layerId === id) selection.delete(nid);
    set({
      layers: { ...s.layers, [id]: { ...s.layers[id], locked, updatedAt: Date.now() } },
      dirtyLayerIds: new Set(s.dirtyLayerIds).add(id),
      selection,
      history: [...s.history.slice(-HISTORY_LIMIT + 1), prev],
      future: [],
    });
  },

  moveLayer: (id, dir) => {
    const s = get();
    const ordered = layerOrder(s.layers);
    const i = ordered.findIndex((l) => l.id === id);
    const j = dir === 'up' ? i + 1 : i - 1;
    if (i < 0 || j < 0 || j >= ordered.length) return;
    const prev = snapshot(s);
    const now = Date.now();
    const a = ordered[i];
    const b = ordered[j];
    set({
      layers: {
        ...s.layers,
        [a.id]: { ...a, position: b.position, updatedAt: now },
        [b.id]: { ...b, position: a.position, updatedAt: now },
      },
      dirtyLayerIds: new Set(s.dirtyLayerIds).add(a.id).add(b.id),
      history: [...s.history.slice(-HISTORY_LIMIT + 1), prev],
      future: [],
    });
  },

  deleteLayer: (id, mode) => {
    const s = get();
    const ordered = layerOrder(s.layers);
    if (ordered.length <= 1 || !s.layers[id]) return false;
    const prev = snapshot(s);
    const i = ordered.findIndex((l) => l.id === id);
    const target = ordered[i - 1] ?? ordered[i + 1];
    const nodes = { ...s.nodes };
    const edges = { ...s.edges };
    const dirtyN = new Set(s.dirtyNodeIds);
    const delN = new Set(s.deletedNodeIds);
    const delE = new Set(s.deletedEdgeIds);
    const selection = new Set(s.selection);
    const now = Date.now();
    for (const n of Object.values(s.nodes)) {
      if (n.layerId !== id) continue;
      if (mode === 'merge') {
        nodes[n.id] = { ...n, layerId: target.id, updatedAt: now };
        dirtyN.add(n.id);
      } else {
        delete nodes[n.id];
        delN.add(n.id);
        selection.delete(n.id);
        for (const e of Object.values(edges)) {
          if (e.fromNode === n.id || e.toNode === n.id) {
            delete edges[e.id];
            delE.add(e.id);
          }
        }
      }
    }
    const rest = { ...s.layers };
    delete rest[id];
    const layers = renumberLayers(rest);
    const dirtyL = new Set(s.dirtyLayerIds);
    for (const l of Object.values(layers)) if (l !== s.layers[l.id]) dirtyL.add(l.id);
    dirtyL.delete(id);
    set({
      nodes,
      edges,
      layers,
      currentLayerId: s.currentLayerId === id ? target.id : s.currentLayerId,
      soloLayerId: s.soloLayerId === id ? null : s.soloLayerId,
      selection,
      dirtyNodeIds: dirtyN,
      deletedNodeIds: delN,
      deletedEdgeIds: delE,
      dirtyLayerIds: dirtyL,
      deletedLayerIds: new Set(s.deletedLayerIds).add(id),
      history: [...s.history.slice(-HISTORY_LIMIT + 1), prev],
      future: [],
    });
    return true;
  },

  setCurrentLayer: (id) => {
    if (!get().layers[id]) return;
    set({ currentLayerId: id });
  },

  setSoloLayer: (id) => {
    const s = get();
    const soloLayerId = id && s.layers[id] ? id : null;
    const selection = new Set(s.selection);
    if (soloLayerId) for (const nid of selection) if (s.nodes[nid]?.layerId !== soloLayerId) selection.delete(nid);
    set({ soloLayerId, selection });
  },

  moveNodesToLayer: (ids, layerId) => {
    const s = get();
    if (!s.layers[layerId]) return;
    const prev = snapshot(s);
    const nodes = { ...s.nodes };
    const dirty = new Set(s.dirtyNodeIds);
    const now = Date.now();
    let changed = false;
    for (const id of ids) {
      const n = nodes[id];
      if (!n || n.layerId === layerId) continue;
      nodes[id] = { ...n, layerId, updatedAt: now };
      dirty.add(id);
      changed = true;
    }
    if (!changed) return;
    set({
      nodes,
      dirtyNodeIds: dirty,
      currentLayerId: layerId,
      history: [...s.history.slice(-HISTORY_LIMIT + 1), prev],
      future: [],
    });
  },

  shiftSelectionLayer: (dir) => {
    const s = get();
    const ids = [...s.selection];
    if (!ids.length) return;
    const ordered = layerOrder(s.layers);
    const first = s.nodes[ids[0]];
    if (!first) return;
    const i = ordered.findIndex((l) => l.id === first.layerId);
    const target = ordered[dir === 'up' ? i + 1 : i - 1];
    if (!target) return;
    get().moveNodesToLayer(ids, target.id);
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
    const layerUpserts: Layer[] = [];
    for (const id of s.dirtyLayerIds) {
      const l = s.layers[id];
      if (l) layerUpserts.push(l);
    }
    const layerDeletions = [...s.deletedLayerIds];
    set({
      dirtyNodeIds: new Set(),
      dirtyEdgeIds: new Set(),
      deletedNodeIds: new Set(),
      deletedEdgeIds: new Set(),
      dirtyLayerIds: new Set(),
      deletedLayerIds: new Set(),
    });
    return { upserts, deletions, edgeUpserts, edgeDeletions, layerUpserts, layerDeletions };
  },
}));

export const DEFAULT_NODE_STYLE: NodeStyle = {
  fill: '#f4f6f8',
  stroke: '#0b0d10',
  strokeWidth: 2,
  opacity: 1,
  fontSize: 16,
  fontFamily: 'Inter, system-ui, sans-serif',
  fontWeight: 500,
  color: '#0b0d10',
  textAlign: 'center',
  cornerRadius: 8,
};

export const DEFAULT_EDGE_ROUTING: EdgeRouting = 'straight';
