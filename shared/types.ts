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
  };
  exportPng: (payload: { defaultName: string; dataUrl: string }) => Promise<{ saved: boolean; path?: string }>;
  exportSvg: (payload: { defaultName: string; xml: string }) => Promise<{ saved: boolean; path?: string }>;
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
