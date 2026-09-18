import { ipcMain, dialog, shell, clipboard, BrowserWindow } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { basename, extname } from 'node:path';
import * as projectsRepo from './repo/projects';
import * as boardsRepo from './repo/boards';
import * as elementsRepo from './repo/elements';
import * as imagesRepo from './repo/images';
import * as metaRepo from './repo/meta';
import * as layersRepo from './repo/layers';
import { hasApiKey, runVectorize } from './vectorize';
import { backupKeep, backupStatus, revealBackups, runBackup, setBackupKeep } from './backup';
import {
  DEFAULT_VECTORIZE_MODEL,
  sanitizePalette,
  type AppSettings,
  type CanvasEdge,
  type CanvasNode,
  type Layer,
  type PickedImageFile,
  type TextFileFilter,
  type VectorizeRequest,
  type Viewport,
} from '@shared/types';

function readSettings(): AppSettings {
  let palette: unknown = null;
  try {
    const raw = metaRepo.getMeta('palette');
    palette = raw ? JSON.parse(raw) : null;
  } catch {
    palette = null;
  }
  return {
    vectorizeModel: metaRepo.getMeta('vectorize.model') ?? DEFAULT_VECTORIZE_MODEL,
    palette: sanitizePalette(palette),
    backupKeep: backupKeep(),
  };
}

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
};

export function registerIpcHandlers() {
  ipcMain.handle('projects:list', () => projectsRepo.listProjects());
  ipcMain.handle('projects:create', (_e, name: string) => projectsRepo.createProject(name));
  ipcMain.handle('projects:rename', (_e, id: string, name: string) =>
    projectsRepo.renameProject(id, name)
  );
  ipcMain.handle('projects:remove', (_e, id: string) => projectsRepo.deleteProject(id));

  ipcMain.handle('boards:listByProject', (_e, projectId: string) =>
    boardsRepo.listBoardsByProject(projectId)
  );
  ipcMain.handle('boards:listAll', () => boardsRepo.listAllBoards());
  ipcMain.handle('boards:create', (_e, projectId: string, name: string) =>
    boardsRepo.createBoard(projectId, name)
  );
  ipcMain.handle('boards:rename', (_e, id: string, name: string) => boardsRepo.renameBoard(id, name));
  ipcMain.handle('boards:remove', (_e, id: string) => boardsRepo.deleteBoard(id));
  ipcMain.handle('boards:duplicate', (_e, id: string, newName: string) =>
    boardsRepo.duplicateBoard(id, newName)
  );
  ipcMain.handle('boards:load', (_e, id: string) => boardsRepo.loadBoard(id));
  ipcMain.handle('boards:setViewport', (_e, id: string, viewport: Viewport) =>
    boardsRepo.setBoardViewport(id, viewport)
  );
  ipcMain.handle('boards:setDimReferences', (_e, id: string, dim: boolean) =>
    boardsRepo.setBoardDimReferences(id, dim)
  );
  ipcMain.handle('boards:setCurrentLayer', (_e, id: string, layerId: string) =>
    boardsRepo.setBoardCurrentLayer(id, layerId)
  );
  ipcMain.handle('layers:upsertMany', (_e, boardId: string, layers: Layer[]) =>
    layersRepo.upsertLayers(boardId, layers)
  );
  ipcMain.handle('layers:removeMany', (_e, ids: string[]) => layersRepo.removeLayers(ids));
  ipcMain.handle('boards:setBackground', (_e, id: string, background: string) =>
    boardsRepo.setBoardBackground(id, background)
  );

  ipcMain.handle('nodes:upsertMany', (_e, boardId: string, nodes: CanvasNode[]) =>
    elementsRepo.upsertNodes(boardId, nodes)
  );
  ipcMain.handle('nodes:removeMany', (_e, ids: string[]) => elementsRepo.removeNodes(ids));

  ipcMain.handle('edges:upsertMany', (_e, boardId: string, edges: CanvasEdge[]) =>
    elementsRepo.upsertEdges(boardId, edges)
  );
  ipcMain.handle('edges:removeMany', (_e, ids: string[]) => elementsRepo.removeEdges(ids));

  ipcMain.handle(
    'images:store',
    (_e, payload: { mime: string; bytes: ArrayBuffer; width: number; height: number }) => {
      const buf = Buffer.from(payload.bytes);
      return imagesRepo.storeImage({ ...payload, bytes: buf });
    }
  );
  ipcMain.handle('images:get', (_e, id: string) => imagesRepo.getImage(id));
  ipcMain.handle('images:pickFile', async (event): Promise<PickedImageFile | null> => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win!, {
      title: 'Import image',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: IMAGE_EXTENSIONS }],
    });
    if (result.canceled || !result.filePaths.length) return null;
    const path = result.filePaths[0];
    const ext = extname(path).slice(1).toLowerCase();
    const mime = MIME_BY_EXT[ext];
    if (!mime) return null;
    const buf = await readFile(path);
    // Copy into a standalone ArrayBuffer so structured clone sends exactly the file bytes.
    const bytes = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    return { name: basename(path), mime, bytes };
  });

  // Test seam: HALDRAW_EXPORT_CAPTURE_DIR=<dir> writes exports there under
  // their default name with no save dialog. Only a launcher that sets the
  // variable sees it.
  const captureDir = process.env.HALDRAW_EXPORT_CAPTURE_DIR;
  ipcMain.handle(
    'exportPng',
    async (event, payload: { defaultName: string; dataUrl: string }) => {
      if (captureDir) {
        const p = `${captureDir}/${basename(payload.defaultName)}`;
        await writeFile(p, Buffer.from(payload.dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'));
        return { saved: true, path: p };
      }
      const win = BrowserWindow.fromWebContents(event.sender);
      const result = await dialog.showSaveDialog(win!, {
        defaultPath: payload.defaultName,
        filters: [{ name: 'PNG image', extensions: ['png'] }],
      });
      if (result.canceled || !result.filePath) return { saved: false };
      const base64 = payload.dataUrl.replace(/^data:image\/png;base64,/, '');
      await writeFile(result.filePath, Buffer.from(base64, 'base64'));
      return { saved: true, path: result.filePath };
    }
  );

  ipcMain.handle(
    'exportSvg',
    async (event, payload: { defaultName: string; xml: string }) => {
      if (captureDir) {
        const p = `${captureDir}/${basename(payload.defaultName)}`;
        await writeFile(p, payload.xml, 'utf-8');
        return { saved: true, path: p };
      }
      const win = BrowserWindow.fromWebContents(event.sender);
      const result = await dialog.showSaveDialog(win!, {
        defaultPath: payload.defaultName,
        filters: [{ name: 'SVG image', extensions: ['svg'] }],
      });
      if (result.canceled || !result.filePath) return { saved: false };
      await writeFile(result.filePath, payload.xml, 'utf-8');
      return { saved: true, path: result.filePath };
    }
  );

  ipcMain.handle(
    'files:saveText',
    async (event, payload: { defaultName: string; text: string; filters: TextFileFilter[] }) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const result = await dialog.showSaveDialog(win!, {
        defaultPath: payload.defaultName,
        filters: payload.filters,
      });
      if (result.canceled || !result.filePath) return { saved: false };
      await writeFile(result.filePath, payload.text, 'utf-8');
      return { saved: true, path: result.filePath };
    }
  );
  ipcMain.handle('files:openText', async (event, payload: { filters: TextFileFilter[] }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openFile'],
      filters: payload.filters,
    });
    if (result.canceled || !result.filePaths.length) return null;
    const path = result.filePaths[0];
    const text = await readFile(path, 'utf-8');
    return { name: basename(path), text };
  });

  ipcMain.handle('theme:get', () => (metaRepo.getMeta('theme') ?? 'dark') as 'dark' | 'light');
  ipcMain.handle('theme:set', (_e, theme: 'dark' | 'light') => metaRepo.setMeta('theme', theme));

  ipcMain.handle('settings:get', () => readSettings());
  ipcMain.handle('settings:set', (_e, patch: Partial<AppSettings>) => {
    if (typeof patch.vectorizeModel === 'string' && patch.vectorizeModel.trim()) {
      metaRepo.setMeta('vectorize.model', patch.vectorizeModel.trim());
    }
    if (patch.palette !== undefined) {
      metaRepo.setMeta('palette', JSON.stringify(sanitizePalette(patch.palette)));
    }
    if (typeof patch.backupKeep === 'number' && Number.isFinite(patch.backupKeep)) {
      setBackupKeep(patch.backupKeep);
    }
    return readSettings();
  });
  ipcMain.handle('backups:status', () => backupStatus());
  ipcMain.handle('backups:runNow', () => runBackup({ force: true }));
  ipcMain.handle('backups:reveal', () => revealBackups());
  ipcMain.handle('vectorize:keyStatus', () => ({ present: hasApiKey() }));
  ipcMain.handle('vectorize:run', (_e, req: VectorizeRequest) => runVectorize(req));

  ipcMain.handle('openExternal', async (_e, url: string) => {
    if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)) {
      throw new Error('Only http(s) and mailto links can be opened externally');
    }
    await shell.openExternal(url);
  });
  ipcMain.handle('writeClipboard', (_e, text: string) => {
    clipboard.writeText(text);
  });
  ipcMain.handle('pickColor', (_e, initial: string) => pickColorNative(initial));
}

/**
 * The standard macOS Colors panel via AppleScript's `choose color`. Chromium's
 * own popup is what an HTML colour input shows inside Electron, so the panel
 * is reached this way instead. Values are 16-bit per channel.
 */
function pickColorNative(initial: string): Promise<string | null> {
  const m = /^#([0-9a-f]{6})$/i.exec(initial ?? '');
  const n = m ? parseInt(m[1], 16) : 0xffffff;
  const to16 = (v: number) => Math.round((v / 255) * 65535);
  const rgb = `{${to16((n >> 16) & 255)}, ${to16((n >> 8) & 255)}, ${to16(n & 255)}}`;
  const script = `tell me to activate\nset c to choose color default color ${rgb}\nreturn (item 1 of c as integer) & "," & (item 2 of c as integer) & "," & (item 3 of c as integer) as string`;
  return new Promise((resolve) => {
    execFile('osascript', ['-e', script], { timeout: 10 * 60 * 1000 }, (err, stdout) => {
      if (err) {
        // Exit 1 with "User canceled. (-128)" on Cancel; anything else is also "no colour".
        resolve(null);
        return;
      }
      const parts = String(stdout).trim().split(',').map((x) => Number(x.trim()));
      if (parts.length !== 3 || parts.some((x) => !Number.isFinite(x))) {
        resolve(null);
        return;
      }
      const hex = parts.map((x) => Math.round((Math.max(0, Math.min(65535, x)) / 65535) * 255).toString(16).padStart(2, '0')).join('');
      resolve(`#${hex}`);
    });
  });
}
