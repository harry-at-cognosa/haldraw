import { app, BrowserWindow, Menu, shell, type MenuItemConstructorOptions } from 'electron';
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

/**
 * Explicit application menu. Reproduces the parts of Electron's default menu
 * the renderer relies on (Edit roles route ⌘C/⌘V/⌘A to the web contents on
 * macOS) and adds File ▸ Import Image…. The default View zoom roles are left
 * out on purpose: ⌘0 is the canvas zoom reset.
 */
function buildMenu(): void {
  const isMac = process.platform === 'darwin';
  const sendToFocused = (channel: string) => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    win?.webContents.send(channel);
  };
  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' } as MenuItemConstructorOptions] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Import Image…',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => sendToFocused('menu:importImage'),
        },
        {
          label: 'Import Board (.haldraw)…',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => sendToFocused('menu:importBoard'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
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
  buildMenu();

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
