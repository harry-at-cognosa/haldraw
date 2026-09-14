export type NodeType = 'rect' | 'ellipse' | 'diamond' | 'text' | 'icon' | 'image';

export type EdgeRouting = 'straight' | 'orthogonal' | 'curved';

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
  /** Reference layer: rendered and exported, but ignored by every pointer interaction. */
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
  arrowStart: boolean;
  arrowEnd: boolean;
  style: EdgeStyle;
  label?: string;
  midpoint: { x: number; y: number } | null;
  labelPoint: { x: number; y: number } | null;
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

export type MenuChannel = 'menu:importImage' | 'menu:importBoard';

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
  nodes: Array<Omit<CanvasNode, 'boardId'>>;
  edges: Array<Omit<CanvasEdge, 'boardId'>>;
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
}

declare global {
  interface Window {
    haldraw: HaldrawApi;
  }
}
