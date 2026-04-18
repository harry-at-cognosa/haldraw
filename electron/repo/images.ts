import { createHash } from 'node:crypto';
import { getDb } from '../db';
import type { ImageBlob } from '@shared/types';

export function storeImage(payload: {
  mime: string;
  bytes: Buffer;
  width: number;
  height: number;
}): string {
  const id = createHash('sha256').update(payload.bytes).digest('hex');
  const existing = getDb().prepare('SELECT id FROM images WHERE id = ?').get(id);
  if (!existing) {
    getDb()
      .prepare('INSERT INTO images (id, mime, data, width, height) VALUES (?, ?, ?, ?, ?)')
      .run(id, payload.mime, payload.bytes, payload.width, payload.height);
  }
  return id;
}

export function getImage(id: string): ImageBlob | null {
  const row = getDb()
    .prepare('SELECT id, mime, data, width, height FROM images WHERE id = ?')
    .get(id) as { id: string; mime: string; data: Buffer; width: number; height: number } | undefined;
  if (!row) return null;
  const dataUrl = `data:${row.mime};base64,${row.data.toString('base64')}`;
  return { id: row.id, mime: row.mime, width: row.width, height: row.height, dataUrl };
}
