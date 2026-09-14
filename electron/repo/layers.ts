import { getDb } from '../db';
import type { Layer } from '@shared/types';

type LayerRow = {
  id: string;
  board_id: string;
  name: string;
  position: number;
  visible: number;
  locked: number;
  created_at: number;
  updated_at: number;
};

function toLayer(r: LayerRow): Layer {
  return {
    id: r.id,
    boardId: r.board_id,
    name: r.name,
    position: r.position,
    visible: r.visible === 1,
    locked: r.locked === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function listLayersByBoard(boardId: string): Layer[] {
  const rows = getDb()
    .prepare('SELECT * FROM layers WHERE board_id = ? ORDER BY position ASC, created_at ASC')
    .all(boardId) as LayerRow[];
  return rows.map(toLayer);
}

export function upsertLayers(boardId: string, layers: Layer[]): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO layers (id, board_id, name, position, visible, locked, created_at, updated_at)
    VALUES (@id, @board_id, @name, @position, @visible, @locked, @created_at, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      position = excluded.position,
      visible = excluded.visible,
      locked = excluded.locked,
      updated_at = excluded.updated_at
  `);
  const touch = db.prepare('UPDATE boards SET updated_at = ? WHERE id = ?');
  const tx = db.transaction((rows: Layer[]) => {
    for (const l of rows) {
      stmt.run({
        id: l.id,
        board_id: boardId,
        name: l.name,
        position: l.position,
        visible: l.visible ? 1 : 0,
        locked: l.locked ? 1 : 0,
        created_at: l.createdAt,
        updated_at: l.updatedAt,
      });
    }
    touch.run(Date.now(), boardId);
  });
  tx(layers);
}

export function removeLayers(ids: string[]): void {
  if (!ids.length) return;
  const db = getDb();
  const stmt = db.prepare('DELETE FROM layers WHERE id = ?');
  const tx = db.transaction((rows: string[]) => {
    for (const id of rows) stmt.run(id);
  });
  tx(ids);
}
