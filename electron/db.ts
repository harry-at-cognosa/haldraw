import { app } from 'electron';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import Database from 'better-sqlite3';
import crypto from 'node:crypto';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  const dir = app.getPath('userData');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, 'haldraw.db');
  db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS boards (
      id         TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      viewport   TEXT NOT NULL DEFAULT '{"x":0,"y":0,"zoom":1}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nodes (
      id         TEXT PRIMARY KEY,
      board_id   TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      type       TEXT NOT NULL,
      x          REAL NOT NULL,
      y          REAL NOT NULL,
      width      REAL NOT NULL,
      height     REAL NOT NULL,
      rotation   REAL NOT NULL DEFAULT 0,
      z_index    INTEGER NOT NULL DEFAULT 0,
      style      TEXT NOT NULL DEFAULT '{}',
      content    TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS edges (
      id          TEXT PRIMARY KEY,
      board_id    TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      from_node   TEXT REFERENCES nodes(id) ON DELETE CASCADE,
      from_anchor TEXT,
      from_point  TEXT,
      to_node     TEXT REFERENCES nodes(id) ON DELETE CASCADE,
      to_anchor   TEXT,
      to_point    TEXT,
      routing     TEXT NOT NULL DEFAULT 'straight',
      arrow_start INTEGER NOT NULL DEFAULT 0,
      arrow_end   INTEGER NOT NULL DEFAULT 0,
      style       TEXT NOT NULL DEFAULT '{}',
      label       TEXT,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS images (
      id     TEXT PRIMARY KEY,
      mime   TEXT NOT NULL,
      data   BLOB NOT NULL,
      width  INTEGER NOT NULL,
      height INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS layers (
      id         TEXT PRIMARY KEY,
      board_id   TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      position   INTEGER NOT NULL DEFAULT 0,
      visible    INTEGER NOT NULL DEFAULT 1,
      locked     INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS layers_board ON layers(board_id);

    CREATE INDEX IF NOT EXISTS nodes_board ON nodes(board_id);
    CREATE INDEX IF NOT EXISTS edges_board ON edges(board_id);
    CREATE INDEX IF NOT EXISTS edges_from  ON edges(from_node);
    CREATE INDEX IF NOT EXISTS edges_to    ON edges(to_node);
  `);
  addColumnIfMissing(db, 'boards', 'background', `TEXT NOT NULL DEFAULT '#ffffff'`);
  addColumnIfMissing(db, 'nodes', 'group_id', `TEXT`);
  addColumnIfMissing(db, 'edges', 'midpoint', `TEXT`);
  addColumnIfMissing(db, 'edges', 'label_point', `TEXT`);
  addColumnIfMissing(db, 'nodes', 'locked', `INTEGER NOT NULL DEFAULT 0`);
  addColumnIfMissing(db, 'boards', 'dim_references', `INTEGER NOT NULL DEFAULT 0`);
  addColumnIfMissing(db, 'nodes', 'layer_id', `TEXT`);
  addColumnIfMissing(db, 'boards', 'current_layer', `TEXT`);
  migrateLayers(db);
  migrateEdges(db);
}

/**
 * 0.7.0: every board gets at least one layer; every node gets a layer_id.
 * Idempotent: boards that already have layers are left alone, and stray nodes
 * without a layer are attached to the board's bottom layer.
 */
function migrateLayers(db: Database.Database) {
  const boards = db.prepare('SELECT id FROM boards').all() as Array<{ id: string }>;
  const hasLayers = db.prepare('SELECT COUNT(*) AS n FROM layers WHERE board_id = ?');
  const bottomLayer = db.prepare('SELECT id FROM layers WHERE board_id = ? ORDER BY position ASC LIMIT 1');
  const insertLayer = db.prepare(
    'INSERT INTO layers (id, board_id, name, position, visible, locked, created_at, updated_at) VALUES (?, ?, ?, 0, 1, 0, ?, ?)'
  );
  const attachNodes = db.prepare('UPDATE nodes SET layer_id = ? WHERE board_id = ? AND layer_id IS NULL');
  const setCurrent = db.prepare('UPDATE boards SET current_layer = ? WHERE id = ? AND current_layer IS NULL');
  const tx = db.transaction(() => {
    const now = Date.now();
    for (const b of boards) {
      let layerId: string;
      const count = (hasLayers.get(b.id) as { n: number }).n;
      if (count === 0) {
        layerId = ulidLike(now);
        insertLayer.run(layerId, b.id, 'Layer 1', now, now);
      } else {
        layerId = (bottomLayer.get(b.id) as { id: string }).id;
      }
      attachNodes.run(layerId, b.id);
      setCurrent.run(layerId, b.id);
    }
  });
  tx();
}

/**
 * 0.8.0: edges get a layer and two head styles.
 * - `layer_id`: from the from-node, else the to-node, else the board's current
 *   layer (a loose line was drawn while that layer was current; the bottom layer
 *   is usually a locked reference and would keep the line hidden), else bottom.
 * - `head_start` / `head_end`: seeded from the old `arrow_start` / `arrow_end`
 *   booleans only when the head columns are first added, so a later "none" set
 *   by the user is never overridden on relaunch. The boolean columns stay (and
 *   are still written as mirrors) so a 0.7.x build can open the same database.
 */
function migrateEdges(db: Database.Database) {
  const cols = db.prepare('PRAGMA table_info(edges)').all() as Array<{ name: string }>;
  const hadHeads = cols.some((c) => c.name === 'head_end');
  addColumnIfMissing(db, 'edges', 'layer_id', `TEXT`);
  addColumnIfMissing(db, 'edges', 'head_start', `TEXT NOT NULL DEFAULT 'none'`);
  addColumnIfMissing(db, 'edges', 'head_end', `TEXT NOT NULL DEFAULT 'none'`);
  db.exec('CREATE INDEX IF NOT EXISTS edges_layer ON edges(layer_id)');
  const tx = db.transaction(() => {
    if (!hadHeads) {
      db.exec(`UPDATE edges SET head_start = 'arrow' WHERE arrow_start = 1 AND head_start = 'none'`);
      db.exec(`UPDATE edges SET head_end = 'arrow' WHERE arrow_end = 1 AND head_end = 'none'`);
    }
    db.exec(`
      UPDATE edges SET layer_id = (SELECT layer_id FROM nodes WHERE nodes.id = edges.from_node)
        WHERE layer_id IS NULL AND from_node IS NOT NULL;
      UPDATE edges SET layer_id = (SELECT layer_id FROM nodes WHERE nodes.id = edges.to_node)
        WHERE layer_id IS NULL AND to_node IS NOT NULL;
      UPDATE edges SET layer_id = (
          SELECT b.current_layer FROM boards b JOIN layers l ON l.id = b.current_layer WHERE b.id = edges.board_id
        )
        WHERE layer_id IS NULL;
      UPDATE edges SET layer_id = (
          SELECT id FROM layers WHERE layers.board_id = edges.board_id ORDER BY position ASC LIMIT 1
        )
        WHERE layer_id IS NULL;
    `);
  });
  tx();
}

/** ULID-shaped id without pulling the ulid package into the migration path. */
function ulidLike(now: number): string {
  const t = now.toString(36).toUpperCase().padStart(10, '0');
  const r = Array.from(crypto.getRandomValues(new Uint8Array(10)))
    .map((b) => (b % 32).toString(32))
    .join('')
    .toUpperCase();
  return (t + r).slice(0, 26);
}

function addColumnIfMissing(
  db: Database.Database,
  table: string,
  column: string,
  definition: string
) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (cols.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
