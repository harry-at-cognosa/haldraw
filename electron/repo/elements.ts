import { getDb } from '../db';
import type { CanvasEdge, CanvasNode, EdgeRouting, NodeType } from '@shared/types';

type NodeRow = {
  id: string;
  board_id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  z_index: number;
  style: string;
  content: string;
  group_id: string | null;
  created_at: number;
  updated_at: number;
};

type EdgeRow = {
  id: string;
  board_id: string;
  from_node: string | null;
  from_anchor: string | null;
  from_point: string | null;
  to_node: string | null;
  to_anchor: string | null;
  to_point: string | null;
  routing: string;
  arrow_start: number;
  arrow_end: number;
  style: string;
  label: string | null;
  midpoint: string | null;
  label_point: string | null;
  created_at: number;
  updated_at: number;
};

function toNode(row: NodeRow): CanvasNode {
  return {
    id: row.id,
    boardId: row.board_id,
    type: row.type as NodeType,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    rotation: row.rotation,
    zIndex: row.z_index,
    style: JSON.parse(row.style),
    content: JSON.parse(row.content),
    groupId: row.group_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toEdge(row: EdgeRow): CanvasEdge {
  return {
    id: row.id,
    boardId: row.board_id,
    fromNode: row.from_node,
    fromAnchor: (row.from_anchor ?? null) as CanvasEdge['fromAnchor'],
    fromPoint: row.from_point ? JSON.parse(row.from_point) : null,
    toNode: row.to_node,
    toAnchor: (row.to_anchor ?? null) as CanvasEdge['toAnchor'],
    toPoint: row.to_point ? JSON.parse(row.to_point) : null,
    routing: row.routing as EdgeRouting,
    arrowStart: row.arrow_start === 1,
    arrowEnd: row.arrow_end === 1,
    style: JSON.parse(row.style),
    label: row.label ?? undefined,
    midpoint: row.midpoint ? JSON.parse(row.midpoint) : null,
    labelPoint: row.label_point ? JSON.parse(row.label_point) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listNodesByBoard(boardId: string): CanvasNode[] {
  const rows = getDb()
    .prepare('SELECT * FROM nodes WHERE board_id = ? ORDER BY z_index ASC, created_at ASC')
    .all(boardId) as NodeRow[];
  return rows.map(toNode);
}

export function listEdgesByBoard(boardId: string): CanvasEdge[] {
  const rows = getDb()
    .prepare('SELECT * FROM edges WHERE board_id = ? ORDER BY created_at ASC')
    .all(boardId) as EdgeRow[];
  return rows.map(toEdge);
}

export function upsertNodes(boardId: string, nodes: CanvasNode[]): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO nodes (id, board_id, type, x, y, width, height, rotation, z_index, style, content, group_id, created_at, updated_at)
    VALUES (@id, @board_id, @type, @x, @y, @width, @height, @rotation, @z_index, @style, @content, @group_id, @created_at, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      type = excluded.type,
      x = excluded.x,
      y = excluded.y,
      width = excluded.width,
      height = excluded.height,
      rotation = excluded.rotation,
      z_index = excluded.z_index,
      style = excluded.style,
      content = excluded.content,
      group_id = excluded.group_id,
      updated_at = excluded.updated_at
  `);
  const touchBoard = db.prepare('UPDATE boards SET updated_at = ? WHERE id = ?');
  const tx = db.transaction((rows: CanvasNode[]) => {
    for (const n of rows) {
      stmt.run({
        id: n.id,
        board_id: boardId,
        type: n.type,
        x: n.x,
        y: n.y,
        width: n.width,
        height: n.height,
        rotation: n.rotation,
        z_index: n.zIndex,
        style: JSON.stringify(n.style ?? {}),
        content: JSON.stringify(n.content ?? {}),
        group_id: n.groupId ?? null,
        created_at: n.createdAt,
        updated_at: n.updatedAt,
      });
    }
    touchBoard.run(Date.now(), boardId);
  });
  tx(nodes);
}

export function removeNodes(ids: string[]): void {
  if (!ids.length) return;
  const db = getDb();
  const stmt = db.prepare('DELETE FROM nodes WHERE id = ?');
  const tx = db.transaction((rows: string[]) => {
    for (const id of rows) stmt.run(id);
  });
  tx(ids);
}

export function upsertEdges(boardId: string, edges: CanvasEdge[]): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO edges (id, board_id, from_node, from_anchor, from_point, to_node, to_anchor, to_point, routing, arrow_start, arrow_end, style, label, midpoint, label_point, created_at, updated_at)
    VALUES (@id, @board_id, @from_node, @from_anchor, @from_point, @to_node, @to_anchor, @to_point, @routing, @arrow_start, @arrow_end, @style, @label, @midpoint, @label_point, @created_at, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      from_node = excluded.from_node,
      from_anchor = excluded.from_anchor,
      from_point = excluded.from_point,
      to_node = excluded.to_node,
      to_anchor = excluded.to_anchor,
      to_point = excluded.to_point,
      routing = excluded.routing,
      arrow_start = excluded.arrow_start,
      arrow_end = excluded.arrow_end,
      style = excluded.style,
      label = excluded.label,
      midpoint = excluded.midpoint,
      label_point = excluded.label_point,
      updated_at = excluded.updated_at
  `);
  const touchBoard = db.prepare('UPDATE boards SET updated_at = ? WHERE id = ?');
  const tx = db.transaction((rows: CanvasEdge[]) => {
    for (const e of rows) {
      stmt.run({
        id: e.id,
        board_id: boardId,
        from_node: e.fromNode,
        from_anchor: e.fromAnchor,
        from_point: e.fromPoint ? JSON.stringify(e.fromPoint) : null,
        to_node: e.toNode,
        to_anchor: e.toAnchor,
        to_point: e.toPoint ? JSON.stringify(e.toPoint) : null,
        routing: e.routing,
        arrow_start: e.arrowStart ? 1 : 0,
        arrow_end: e.arrowEnd ? 1 : 0,
        style: JSON.stringify(e.style ?? {}),
        label: e.label ?? null,
        midpoint: e.midpoint ? JSON.stringify(e.midpoint) : null,
        label_point: e.labelPoint ? JSON.stringify(e.labelPoint) : null,
        created_at: e.createdAt,
        updated_at: e.updatedAt,
      });
    }
    touchBoard.run(Date.now(), boardId);
  });
  tx(edges);
}

export function removeEdges(ids: string[]): void {
  if (!ids.length) return;
  const db = getDb();
  const stmt = db.prepare('DELETE FROM edges WHERE id = ?');
  const tx = db.transaction((rows: string[]) => {
    for (const id of rows) stmt.run(id);
  });
  tx(ids);
}
