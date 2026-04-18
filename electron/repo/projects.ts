import { ulid } from 'ulid';
import { getDb } from '../db';
import type { Project } from '@shared/types';

type ProjectRow = {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
};

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listProjects(): Project[] {
  const rows = getDb()
    .prepare('SELECT * FROM projects ORDER BY updated_at DESC')
    .all() as ProjectRow[];
  return rows.map(toProject);
}

export function createProject(name: string): Project {
  const now = Date.now();
  const p: Project = { id: ulid(), name, createdAt: now, updatedAt: now };
  getDb()
    .prepare('INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
    .run(p.id, p.name, p.createdAt, p.updatedAt);
  return p;
}

export function renameProject(id: string, name: string): void {
  getDb()
    .prepare('UPDATE projects SET name = ?, updated_at = ? WHERE id = ?')
    .run(name, Date.now(), id);
}

export function deleteProject(id: string): void {
  getDb().prepare('DELETE FROM projects WHERE id = ?').run(id);
}
