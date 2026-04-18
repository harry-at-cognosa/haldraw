import { ulid } from 'ulid';
import { getDb } from '../db';
import type { Board, BoardSnapshot, Viewport } from '@shared/types';
import { listNodesByBoard } from './elements';
import { listEdgesByBoard } from './elements';

type BoardRow = {
  id: string;
  project_id: string;
  name: string;
  viewport: string;
  background: string | null;
  created_at: number;
  updated_at: number;
};

function toBoard(row: BoardRow): Board {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    viewport: JSON.parse(row.viewport) as Viewport,
    background: row.background ?? '#ffffff',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listBoardsByProject(projectId: string): Board[] {
  const rows = getDb()
    .prepare('SELECT * FROM boards WHERE project_id = ? ORDER BY updated_at DESC')
    .all(projectId) as BoardRow[];
  return rows.map(toBoard);
}

export function getBoard(id: string): Board | null {
  const row = getDb().prepare('SELECT * FROM boards WHERE id = ?').get(id) as BoardRow | undefined;
  return row ? toBoard(row) : null;
}

export function createBoard(projectId: string, name: string): Board {
  const now = Date.now();
  const b: Board = {
    id: ulid(),
    projectId,
    name,
    viewport: { x: 0, y: 0, zoom: 1 },
    background: '#ffffff',
    createdAt: now,
    updatedAt: now,
  };
  getDb()
    .prepare(
      'INSERT INTO boards (id, project_id, name, viewport, background, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(b.id, b.projectId, b.name, JSON.stringify(b.viewport), b.background, b.createdAt, b.updatedAt);
  return b;
}

export function renameBoard(id: string, name: string): void {
  getDb()
    .prepare('UPDATE boards SET name = ?, updated_at = ? WHERE id = ?')
    .run(name, Date.now(), id);
}

export function deleteBoard(id: string): void {
  getDb().prepare('DELETE FROM boards WHERE id = ?').run(id);
}

export function setBoardViewport(id: string, viewport: Viewport): void {
  getDb()
    .prepare('UPDATE boards SET viewport = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(viewport), Date.now(), id);
}

export function setBoardBackground(id: string, background: string): void {
  getDb()
    .prepare('UPDATE boards SET background = ?, updated_at = ? WHERE id = ?')
    .run(background, Date.now(), id);
}

export function duplicateBoard(id: string, newName: string): Board | null {
  const db = getDb();
  const source = getBoard(id);
  if (!source) return null;
  const now = Date.now();
  const newId = ulid();
  const tx = db.transaction(() => {
    db.prepare(
      'INSERT INTO boards (id, project_id, name, viewport, background, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(newId, source.projectId, newName, JSON.stringify(source.viewport), source.background, now, now);

    const nodeRows = db
      .prepare('SELECT * FROM nodes WHERE board_id = ?')
      .all(id) as Array<{
        id: string;
        type: string;
        x: number;
        y: number;
        width: number;
        height: number;
        rotation: number;
        z_index: number;
        style: string;
        content: string;
      }>;

    const idMap = new Map<string, string>();
    const insertNode = db.prepare(`
      INSERT INTO nodes (id, board_id, type, x, y, width, height, rotation, z_index, style, content, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const n of nodeRows) {
      const nid = ulid();
      idMap.set(n.id, nid);
      insertNode.run(
        nid,
        newId,
        n.type,
        n.x,
        n.y,
        n.width,
        n.height,
        n.rotation,
        n.z_index,
        n.style,
        n.content,
        now,
        now
      );
    }

    const edgeRows = db
      .prepare('SELECT * FROM edges WHERE board_id = ?')
      .all(id) as Array<{
        id: string;
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
      }>;

    const insertEdge = db.prepare(`
      INSERT INTO edges (id, board_id, from_node, from_anchor, from_point, to_node, to_anchor, to_point, routing, arrow_start, arrow_end, style, label, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const e of edgeRows) {
      insertEdge.run(
        ulid(),
        newId,
        e.from_node ? (idMap.get(e.from_node) ?? null) : null,
        e.from_anchor,
        e.from_point,
        e.to_node ? (idMap.get(e.to_node) ?? null) : null,
        e.to_anchor,
        e.to_point,
        e.routing,
        e.arrow_start,
        e.arrow_end,
        e.style,
        e.label,
        now,
        now
      );
    }
  });
  tx();
  return getBoard(newId);
}

export function loadBoard(id: string): BoardSnapshot | null {
  const board = getBoard(id);
  if (!board) return null;
  return {
    board,
    nodes: listNodesByBoard(id),
    edges: listEdgesByBoard(id),
  };
}
