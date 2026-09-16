export type NodeType = 'rect' | 'ellipse' | 'diamond' | 'text' | 'icon' | 'image';

export type EdgeRouting = 'straight' | 'orthogonal' | 'curved';

/** Marker drawn at one end of an edge. */
export type EdgeHead = 'none' | 'arrow' | 'open' | 'dot' | 'diamond' | 'crow';
export const EDGE_HEADS: readonly EdgeHead[] = ['none', 'arrow', 'open', 'dot', 'diamond', 'crow'];

export type Anchor =
  | 'auto'
  | 'top'
  | 'right'
  | 'bottom'
  | 'left'
  | 'center';

export interface NodeStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  opacity?: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  color?: string;
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  cornerRadius?: number;
}

export interface NodeContent {
  text?: string;
  iconName?: string;
  imageId?: string;
  link?: string;
  /** Intrinsic pixel size of the imported image (image nodes only). */
  naturalWidth?: number;
  naturalHeight?: number;
}

/** Ordered, named container of nodes within one board. */
export interface Layer {
  id: string;
  boardId: string;
  name: string;
  /** 0 = bottom of the stack. Dense within a board. */
  position: number;
  visible: boolean;
  locked: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CanvasNode {
  id: string;
  boardId: string;
  type: NodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  style: NodeStyle;
  content: NodeContent;
  groupId: string | null;
  /** Layer this node belongs to. Always set after migration. */
  layerId: string;
  /** Node-level lock: rendered and exported, but ignored by every pointer interaction. */
  locked: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface EdgeStyle {
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  opacity?: number;
  color?: string;
  fontSize?: number;
}

export interface CanvasEdge {
  id: string;
  boardId: string;
  fromNode: string | null;
  fromAnchor: Anchor | null;
  fromPoint: { x: number; y: number } | null;
  toNode: string | null;
  toAnchor: Anchor | null;
  toPoint: { x: number; y: number } | null;
  routing: EdgeRouting;
  headStart: EdgeHead;
  headEnd: EdgeHead;
  style: EdgeStyle;
  label?: string;
  midpoint: { x: number; y: number } | null;
  labelPoint: { x: number; y: number } | null;
  /** Layer this edge belongs to. Always set after migration. */
  layerId: string;
  createdAt: number;
  updatedAt: number;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface Board {
  id: string;
  projectId: string;
  name: string;
  viewport: Viewport;
  background: string;
  /** Render locked (reference) nodes at reduced opacity on the canvas. Never baked into exports. */
  dimReferences: boolean;
  /** Layer new nodes land in. */
  currentLayerId: string;
  createdAt: number;
  updatedAt: number;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface BoardSnapshot {
  board: Board;
  layers: Layer[];
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

export interface ImageBlob {
  id: string;
  mime: string;
  width: number;
  height: number;
  dataUrl: string;
}

export interface PickedImageFile {
  name: string;
  mime: string;
  bytes: ArrayBuffer;
}

export type MenuChannel = 'menu:importImage' | 'menu:importBoard' | 'menu:settings';

// ---- Vectorize (0.9.0): image → editable draft via a vision model ----

export type VectorShapeKind = 'rect' | 'ellipse' | 'diamond' | 'text';

/** One element the model found. Coordinates are pixels of the image as sent, origin top-left. */
export interface VectorShape {
  id: string;
  kind: VectorShapeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Text inside the shape, or '' when none. */
  text: string;
  /** Hex colours or '' when not discernible. */
  fill: string;
  stroke: string;
  /** 0–1. */
  confidence: number;
}

export interface VectorConnector {
  from: string;
  to: string;
  headEnd: 'none' | 'arrow';
  label: string;
  confidence: number;
}

/** The structured output contract; see docs/Vectorize_raster_design.md § Implementation plan. */
export interface VectorizeResult {
  shapes: VectorShape[];
  connectors: VectorConnector[];
}

export interface VectorizeRequest {
  /** PNG, base64 without the data: prefix, long side ≤ 1568 px. */
  pngBase64: string;
  width: number;
  height: number;
  model: string;
}

export interface VectorizeResponse {
  result: VectorizeResult;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export const VECTORIZE_MODELS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'claude-opus-5', label: 'Claude Opus 5 (default)' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
];
export const DEFAULT_VECTORIZE_MODEL = 'claude-opus-5';

export interface AppSettings {
  vectorizeModel: string;
}

export interface TextFileFilter {
  name: string;
  extensions: string[];
}

/** Portable board file (`.haldraw`). Version 1. */
export interface HaldrawBoardFile {
  format: 'haldraw-board';
  version: 1;
  app: string;
  exportedAt: string;
  board: {
    name: string;
    background: string;
    viewport: Viewport;
    dimReferences: boolean;
  };
  /** Absent in files written before 0.7.0; the importer then puts every node on one layer. */
  layers?: Array<Omit<Layer, 'boardId'>>;
  nodes: Array<Omit<CanvasNode, 'boardId' | 'layerId'> & { layerId?: string }>;
  /**
   * `layerId`, `headStart` and `headEnd` are absent in files written before 0.8.0;
   * `arrowStart` / `arrowEnd` are the pre-0.8.0 head booleans, still written as
   * mirrors of the heads so older builds can read the file.
   */
  edges: Array<
    Omit<CanvasEdge, 'boardId' | 'layerId' | 'headStart' | 'headEnd'> & {
      layerId?: string;
      headStart?: EdgeHead;
      headEnd?: EdgeHead;
      arrowStart?: boolean;
      arrowEnd?: boolean;
    }
  >;
  /** Image blobs referenced by nodes, keyed by content-hash id. */
  images: Record<string, { mime: string; width: number; height: number; base64: string }>;
}

export interface HaldrawApi {
  projects: {
    list: () => Promise<Project[]>;
    create: (name: string) => Promise<Project>;
    rename: (id: string, name: string) => Promise<void>;
    remove: (id: string) => Promise<void>;
  };
  boards: {
    listByProject: (projectId: string) => Promise<Board[]>;
    create: (projectId: string, name: string) => Promise<Board>;
    rename: (id: string, name: string) => Promise<void>;
    remove: (id: string) => Promise<void>;
    duplicate: (id: string, newName: string) => Promise<Board | null>;
    load: (id: string) => Promise<BoardSnapshot>;
    setViewport: (id: string, viewport: Viewport) => Promise<void>;
    setBackground: (id: string, background: string) => Promise<void>;
    setDimReferences: (id: string, dim: boolean) => Promise<void>;
    setCurrentLayer: (id: string, layerId: string) => Promise<void>;
  };
  layers: {
    upsertMany: (boardId: string, layers: Layer[]) => Promise<void>;
    removeMany: (ids: string[]) => Promise<void>;
  };
  nodes: {
    upsertMany: (boardId: string, nodes: CanvasNode[]) => Promise<void>;
    removeMany: (ids: string[]) => Promise<void>;
  };
  edges: {
    upsertMany: (boardId: string, edges: CanvasEdge[]) => Promise<void>;
    removeMany: (ids: string[]) => Promise<void>;
  };
  images: {
    store: (payload: { mime: string; bytes: ArrayBuffer; width: number; height: number }) => Promise<string>;
    get: (id: string) => Promise<ImageBlob | null>;
    /** Native open dialog filtered to image types. Resolves null on cancel. */
    pickFile: () => Promise<PickedImageFile | null>;
  };
  files: {
    /** Native save dialog, then write UTF-8 text. */
    saveText: (payload: { defaultName: string; text: string; filters: TextFileFilter[] }) => Promise<{ saved: boolean; path?: string }>;
    /** Native open dialog, then read UTF-8 text. Resolves null on cancel. */
    openText: (payload: { filters: TextFileFilter[] }) => Promise<{ name: string; text: string } | null>;
  };
  /** Subscribe to an application-menu command. Returns an unsubscribe function. */
  onMenu: (channel: MenuChannel, cb: () => void) => () => void;
  exportPng: (payload: { defaultName: string; dataUrl: string }) => Promise<{ saved: boolean; path?: string }>;
  exportSvg: (payload: { defaultName: string; xml: string }) => Promise<{ saved: boolean; path?: string }>;
  openExternal: (url: string) => Promise<void>;
  writeClipboard: (text: string) => Promise<void>;
  theme: {
    get: () => Promise<'dark' | 'light'>;
    set: (theme: 'dark' | 'light') => Promise<void>;
  };
  settings: {
    get: () => Promise<AppSettings>;
    set: (patch: Partial<AppSettings>) => Promise<AppSettings>;
  };
  vectorize: {
    /** Whether the keychain item `haldraw` / `anthropic-api-key` exists. Never returns the key. */
    keyStatus: () => Promise<{ present: boolean }>;
    run: (req: VectorizeRequest) => Promise<VectorizeResponse>;
  };
}

declare global {
  interface Window {
    haldraw: HaldrawApi;
  }
}
