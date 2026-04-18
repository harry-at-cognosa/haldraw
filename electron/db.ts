import { app } from 'electron';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import Database from 'better-sqlite3';

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

    CREATE INDEX IF NOT EXISTS nodes_board ON nodes(board_id);
    CREATE INDEX IF NOT EXISTS edges_board ON edges(board_id);
    CREATE INDEX IF NOT EXISTS edges_from  ON edges(from_node);
    CREATE INDEX IF NOT EXISTS edges_to    ON edges(to_node);
  `);
  addColumnIfMissing(db, 'boards', 'background', `TEXT NOT NULL DEFAULT '#ffffff'`);
  addColumnIfMissing(db, 'nodes', 'group_id', `TEXT`);
  addColumnIfMissing(db, 'edges', 'midpoint', `TEXT`);
  addColumnIfMissing(db, 'edges', 'label_point', `TEXT`);
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
