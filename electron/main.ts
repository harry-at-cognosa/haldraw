import { app, BrowserWindow, shell } from 'electron';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { join } from 'node:path';
import { getDb, closeDb } from './db';
import { registerIpcHandlers } from './ipc';

app.setName('haldraw');

if (process.platform === 'darwin') {
  app.setAboutPanelOptions({
    applicationName: 'haldraw',
    applicationVersion: app.getVersion(),
    version: app.getVersion(),
    copyright: '© 2026 Harry A. Layman, PhD',
    website: 'https://github.com/harry-at-cognosa/haldraw',
  });
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0b0d10',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.on('ready-to-show', () => {
    win.show();
  });

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('net.cognosa.haldraw');

  app.on('browser-window-created', (_e, win) => {
    optimizer.watchWindowShortcuts(win);
  });

  getDb();
  registerIpcHandlers();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  closeDb();
});
