import { ipcMain, dialog, shell, clipboard, BrowserWindow } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import * as projectsRepo from './repo/projects';
import * as boardsRepo from './repo/boards';
import * as elementsRepo from './repo/elements';
import * as imagesRepo from './repo/images';
import * as metaRepo from './repo/meta';
import type { CanvasEdge, CanvasNode, PickedImageFile, Viewport } from '@shared/types';

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

  ipcMain.handle(
    'exportPng',
    async (event, payload: { defaultName: string; dataUrl: string }) => {
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

  ipcMain.handle('theme:get', () => (metaRepo.getMeta('theme') ?? 'dark') as 'dark' | 'light');
  ipcMain.handle('theme:set', (_e, theme: 'dark' | 'light') => metaRepo.setMeta('theme', theme));

  ipcMain.handle('openExternal', async (_e, url: string) => {
    if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)) {
      throw new Error('Only http(s) and mailto links can be opened externally');
    }
    await shell.openExternal(url);
  });
  ipcMain.handle('writeClipboard', (_e, text: string) => {
    clipboard.writeText(text);
  });
}
