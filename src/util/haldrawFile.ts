import {
  EDGE_HEADS,
  type Board,
  type CanvasEdge,
  type CanvasNode,
  type EdgeHead,
  type HaldrawBoardFile,
  type Layer,
  type TextFileFilter,
} from '@shared/types';
import { newId } from '@/util/id';
import { APP_VERSION } from '@/util/version';

export const HALDRAW_FILE_FILTERS: TextFileFilter[] = [
  { name: 'haldraw board', extensions: ['haldraw', 'json'] },
];

/** Build the portable file for the current board. `imageUrls` are data URLs from the editor cache. */
export async function buildBoardFile(
  board: Board,
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  layers: Layer[] = []
): Promise<HaldrawBoardFile> {
  const images: HaldrawBoardFile['images'] = {};
  const ids = new Set<string>();
  for (const n of nodes) if (n.content.imageId) ids.add(n.content.imageId);
  for (const id of ids) {
    const blob = await window.haldraw.images.get(id);
    if (!blob) continue;
    const comma = blob.dataUrl.indexOf(',');
    images[id] = {
      mime: blob.mime,
      width: blob.width,
      height: blob.height,
      base64: blob.dataUrl.slice(comma + 1),
    };
  }
  const strip = <T extends { boardId: string }>(x: T): Omit<T, 'boardId'> => {
    const { boardId: _b, ...rest } = x;
    return rest;
  };
  return {
    format: 'haldraw-board',
    version: 1,
    app: APP_VERSION,
    exportedAt: new Date().toISOString(),
    board: {
      name: board.name,
      background: board.background,
      viewport: board.viewport,
      dimReferences: board.dimReferences,
    },
    layers: [...layers].sort((a, b) => a.position - b.position).map(strip),
    nodes: [...nodes].sort((a, b) => a.zIndex - b.zIndex).map(strip),
    // arrowStart / arrowEnd are mirrors of the heads so pre-0.8.0 builds can read the file.
    edges: edges.map((e) => ({
      ...strip(e),
      arrowStart: e.headStart !== 'none',
      arrowEnd: e.headEnd !== 'none',
    })),
    images,
  };
}

export function serializeBoardFile(file: HaldrawBoardFile): string {
  return JSON.stringify(file, null, 2) + '\n';
}

/** Parse and validate. Throws with a human-readable message on any structural problem. */
export function parseBoardFile(text: string): HaldrawBoardFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new Error(`Not valid JSON: ${(err as Error).message}`);
  }
  if (!raw || typeof raw !== 'object') throw new Error('File is not a JSON object.');
  const f = raw as Partial<HaldrawBoardFile>;
  if (f.format !== 'haldraw-board') throw new Error('Not a haldraw board file (missing "format": "haldraw-board").');
  if (f.version !== 1) throw new Error(`Unsupported file version ${String(f.version)}; this app reads version 1.`);
  if (!f.board || typeof f.board.name !== 'string') throw new Error('Missing board name.');
  if (!Array.isArray(f.nodes)) throw new Error('Missing nodes array.');
  if (!Array.isArray(f.edges)) throw new Error('Missing edges array.');
  const NODE_TYPES = new Set(['rect', 'ellipse', 'diamond', 'box3d', 'dsbox', 'colbox', 'text', 'icon', 'image', 'ink']);
  f.nodes.forEach((n, i) => {
    if (!n || typeof n.id !== 'string') throw new Error(`Node ${i}: missing id.`);
    if (!NODE_TYPES.has(n.type)) throw new Error(`Node ${i}: unknown type "${String(n.type)}".`);
    for (const k of ['x', 'y', 'width', 'height'] as const) {
      if (typeof n[k] !== 'number' || !Number.isFinite(n[k])) throw new Error(`Node ${i}: ${k} must be a number.`);
    }
  });
  const nodeIds = new Set(f.nodes.map((n) => n.id));
  const HEADS = new Set<string>(EDGE_HEADS);
  f.edges.forEach((e, i) => {
    if (!e || typeof e.id !== 'string') throw new Error(`Edge ${i}: missing id.`);
    if (e.fromNode && !nodeIds.has(e.fromNode)) throw new Error(`Edge ${i}: fromNode "${e.fromNode}" not in file.`);
    if (e.toNode && !nodeIds.has(e.toNode)) throw new Error(`Edge ${i}: toNode "${e.toNode}" not in file.`);
    for (const k of ['headStart', 'headEnd'] as const) {
      if (e[k] !== undefined && !HEADS.has(String(e[k]))) throw new Error(`Edge ${e.id}: unknown ${k} "${String(e[k])}".`);
    }
  });
  if (f.layers !== undefined) {
    if (!Array.isArray(f.layers)) throw new Error('layers must be an array.');
    const layerIds = new Set<string>();
    f.layers.forEach((l, i) => {
      if (!l || typeof l.id !== 'string') throw new Error(`Layer ${i}: missing id.`);
      if (typeof l.name !== 'string') throw new Error(`Layer ${i}: missing name.`);
      layerIds.add(l.id);
    });
    for (const n of f.nodes) {
      if (n.layerId && !layerIds.has(n.layerId)) throw new Error(`Node ${n.id} references layer "${n.layerId}" which is not in the file.`);
    }
    for (const e of f.edges) {
      if (e.layerId && !layerIds.has(e.layerId)) throw new Error(`Edge ${e.id} references layer "${e.layerId}" which is not in the file.`);
    }
  }
  const images = f.images && typeof f.images === 'object' ? f.images : {};
  for (const n of f.nodes) {
    const id = n.content?.imageId;
    if (id && !images[id]) throw new Error(`Node ${n.id} references image "${id}" which is not in the file.`);
  }
  return { ...(f as HaldrawBoardFile), images };
}

/**
 * Create a new board in `projectId` from a parsed file. Node, edge and group ids
 * are remapped to fresh ULIDs; image ids are content hashes and stay stable.
 */
export async function importBoardFile(
  projectId: string,
  file: HaldrawBoardFile,
  name: string
): Promise<Board> {
  // Images first, so the content-hash ids exist before nodes reference them.
  for (const [id, img] of Object.entries(file.images)) {
    const bytes = base64ToArrayBuffer(img.base64);
    const storedId = await window.haldraw.images.store({
      mime: img.mime,
      bytes,
      width: img.width,
      height: img.height,
    });
    if (storedId !== id) {
      // Hash mismatch means the file was hand-edited; point nodes at the real id.
      for (const n of file.nodes) if (n.content?.imageId === id) n.content.imageId = storedId;
    }
  }

  const board = await window.haldraw.boards.create(projectId, name);
  const now = Date.now();

  // Layers: the new board comes with "Layer 1". Files written before 0.7.0 have
  // no layers and every node goes there; newer files replace it with their own.
  const layerIdMap = new Map<string, string>();
  let defaultLayerId = board.currentLayerId;
  if (file.layers && file.layers.length) {
    const layers: Layer[] = [...file.layers]
      .sort((a, b) => a.position - b.position)
      .map((l, i) => {
        const id = newId();
        layerIdMap.set(l.id, id);
        return {
          id,
          boardId: board.id,
          name: l.name,
          position: i,
          visible: l.visible !== false,
          locked: Boolean(l.locked),
          createdAt: l.createdAt ?? now,
          updatedAt: now,
        };
      });
    await window.haldraw.layers.upsertMany(board.id, layers);
    if (board.currentLayerId) await window.haldraw.layers.removeMany([board.currentLayerId]);
    defaultLayerId = layers[layers.length - 1].id;
    await window.haldraw.boards.setCurrentLayer(board.id, defaultLayerId);
  }

  const nodeIdMap = new Map<string, string>();
  const groupIdMap = new Map<string, string>();
  for (const n of file.nodes) nodeIdMap.set(n.id, newId());

  const nodes: CanvasNode[] = file.nodes.map((n, i) => {
    let groupId: string | null = null;
    if (n.groupId) {
      groupId = groupIdMap.get(n.groupId) ?? newId();
      groupIdMap.set(n.groupId, groupId);
    }
    return {
      id: nodeIdMap.get(n.id)!,
      boardId: board.id,
      type: n.type,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      rotation: n.rotation ?? 0,
      zIndex: typeof n.zIndex === 'number' ? n.zIndex : i,
      style: n.style ?? {},
      content: n.content ?? {},
      groupId,
      layerId: (n.layerId && layerIdMap.get(n.layerId)) || defaultLayerId,
      locked: Boolean(n.locked),
      createdAt: n.createdAt ?? now,
      updatedAt: now,
    };
  });
  const nodeLayer = new Map(nodes.map((n) => [n.id, n.layerId]));
  const head = (h: EdgeHead | undefined, legacy: boolean | undefined, legacyDefault: boolean): EdgeHead =>
    h ?? ((legacy ?? legacyDefault) ? 'arrow' : 'none');
  const edges: CanvasEdge[] = file.edges.map((e) => {
    const fromNode = e.fromNode ? nodeIdMap.get(e.fromNode) ?? null : null;
    const toNode = e.toNode ? nodeIdMap.get(e.toNode) ?? null : null;
    // Pre-0.8.0 files: an edge follows its from-node, else its to-node, else the
    // top layer, the same default a node without layerId gets.
    const layerId =
      (e.layerId && layerIdMap.get(e.layerId)) ||
      (fromNode && nodeLayer.get(fromNode)) ||
      (toNode && nodeLayer.get(toNode)) ||
      defaultLayerId;
    return {
      id: newId(),
      boardId: board.id,
      fromNode,
      fromAnchor: e.fromAnchor ?? null,
      fromPoint: e.fromPoint ?? null,
      toNode,
      toAnchor: e.toAnchor ?? null,
      toPoint: e.toPoint ?? null,
      routing: e.routing ?? 'straight',
      headStart: head(e.headStart, e.arrowStart, false),
      headEnd: head(e.headEnd, e.arrowEnd, true),
      style: e.style ?? {},
      label: e.label,
      midpoint: e.midpoint ?? null,
      labelPoint: e.labelPoint ?? null,
      layerId,
      createdAt: e.createdAt ?? now,
      updatedAt: now,
    };
  });

  if (nodes.length) await window.haldraw.nodes.upsertMany(board.id, nodes);
  if (edges.length) await window.haldraw.edges.upsertMany(board.id, edges);
  if (file.board.background) await window.haldraw.boards.setBackground(board.id, file.board.background);
  if (file.board.viewport) await window.haldraw.boards.setViewport(board.id, file.board.viewport);
  if (file.board.dimReferences) await window.haldraw.boards.setDimReferences(board.id, true);

  return {
    ...board,
    background: file.board.background ?? board.background,
    viewport: file.board.viewport ?? board.viewport,
    dimReferences: Boolean(file.board.dimReferences),
    currentLayerId: defaultLayerId,
  };
}

/** Default board name for an imported file: the file's own board name, else the filename. */
export function suggestedBoardName(file: HaldrawBoardFile, fileName: string): string {
  const fromFile = file.board.name?.trim();
  if (fromFile) return fromFile;
  return fileName.replace(/\.(haldraw|json)$/i, '') || 'Imported board';
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
