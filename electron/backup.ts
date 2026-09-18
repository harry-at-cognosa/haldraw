import { app, shell } from 'electron';
import { join } from 'node:path';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { getDb } from './db';
import * as metaRepo from './repo/meta';
import { DEFAULT_BACKUP_KEEP, type BackupFile, type BackupStatus } from '@shared/types';

/**
 * Daily snapshots of the database (0.9.12). One file per calendar day in
 * `<userData>/backups/haldraw-YYYY-MM-DD.db`, written with SQLite's online
 * backup API so a WAL in progress is folded in; the newest `keep` files stay,
 * older ones go. Runs at launch and every hour after, and on demand from
 * Settings ("Back up now" adds a time-stamped file when today's exists).
 */
export function backupDir(): string {
  return join(app.getPath('userData'), 'backups');
}

export function backupKeep(): number {
  const v = Number(metaRepo.getMeta('backup.keep'));
  return Number.isInteger(v) && v >= 1 && v <= 365 ? v : DEFAULT_BACKUP_KEEP;
}

export function setBackupKeep(n: number): void {
  const v = Math.max(1, Math.min(365, Math.round(n)));
  metaRepo.setMeta('backup.keep', String(v));
  prune();
}

const NAME = /^haldraw-(\d{4}-\d{2}-\d{2})(?:-(\d{6}))?\.db$/;

function pad(n: number, w = 2): string {
  return String(n).padStart(w, '0');
}

function dateStamp(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function timeStamp(d = new Date()): string {
  return `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** Sort key from the file name: date, then time (the plain daily file counts as 00:00:00). */
function stampKey(name: string): string {
  const m = NAME.exec(name);
  return m ? `${m[1]}-${m[2] ?? '000000'}` : name;
}

/** Newest first. */
export function listBackups(): BackupFile[] {
  const dir = backupDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => NAME.test(f))
    .map((name) => {
      const st = statSync(join(dir, name));
      return { name, path: join(dir, name), size: st.size, mtime: st.mtimeMs };
    })
    .sort((a, b) => (stampKey(a.name) < stampKey(b.name) ? 1 : stampKey(a.name) > stampKey(b.name) ? -1 : 0));
}

function prune(): string[] {
  const keep = backupKeep();
  const removed: string[] = [];
  for (const f of listBackups().slice(keep)) {
    try {
      unlinkSync(f.path);
      removed.push(f.name);
    } catch (err) {
      console.error('backup prune failed', f.path, err);
    }
  }
  return removed;
}

export async function runBackup(opts: { force?: boolean } = {}): Promise<{ path: string; skipped: boolean }> {
  const dir = backupDir();
  mkdirSync(dir, { recursive: true });
  const now = new Date();
  const today = `haldraw-${dateStamp(now)}`;
  let path = join(dir, `${today}.db`);
  // Any snapshot dated today counts: a pruned daily file is not rewritten.
  const todays = listBackups().find((f) => f.name.startsWith(today));
  if (todays) {
    if (!opts.force) return { path: todays.path, skipped: true };
    path = join(dir, `${today}-${timeStamp(now)}.db`);
  }
  await getDb().backup(path);
  prune();
  return { path, skipped: false };
}

export function backupStatus(): BackupStatus {
  return { dir: backupDir(), keep: backupKeep(), files: listBackups() };
}

export function revealBackups(): void {
  const dir = backupDir();
  mkdirSync(dir, { recursive: true });
  const newest = listBackups()[0];
  if (newest) shell.showItemInFolder(newest.path);
  else void shell.openPath(dir);
}

let timer: NodeJS.Timeout | null = null;

/** Launch-time snapshot, then an hourly check so a long-running app still gets one per day. */
export function scheduleBackups(): void {
  const tick = () => {
    runBackup().catch((err) => console.error('daily backup failed', err));
  };
  tick();
  if (!timer) timer = setInterval(tick, 60 * 60 * 1000);
}
