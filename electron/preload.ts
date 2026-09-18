import { contextBridge, ipcRenderer } from 'electron';
import type { HaldrawApi } from '@shared/types';

const api: HaldrawApi = {
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
    create: (name) => ipcRenderer.invoke('projects:create', name),
    rename: (id, name) => ipcRenderer.invoke('projects:rename', id, name),
    remove: (id) => ipcRenderer.invoke('projects:remove', id),
  },
  boards: {
    listByProject: (projectId) => ipcRenderer.invoke('boards:listByProject', projectId),
    listAll: () => ipcRenderer.invoke('boards:listAll'),
    create: (projectId, name) => ipcRenderer.invoke('boards:create', projectId, name),
    rename: (id, name) => ipcRenderer.invoke('boards:rename', id, name),
    remove: (id) => ipcRenderer.invoke('boards:remove', id),
    duplicate: (id, newName) => ipcRenderer.invoke('boards:duplicate', id, newName),
    load: (id) => ipcRenderer.invoke('boards:load', id),
    setViewport: (id, viewport) => ipcRenderer.invoke('boards:setViewport', id, viewport),
    setBackground: (id, background) => ipcRenderer.invoke('boards:setBackground', id, background),
    setDimReferences: (id, dim) => ipcRenderer.invoke('boards:setDimReferences', id, dim),
    setCurrentLayer: (id, layerId) => ipcRenderer.invoke('boards:setCurrentLayer', id, layerId),
  },
  layers: {
    upsertMany: (boardId, layers) => ipcRenderer.invoke('layers:upsertMany', boardId, layers),
    removeMany: (ids) => ipcRenderer.invoke('layers:removeMany', ids),
  },
  nodes: {
    upsertMany: (boardId, nodes) => ipcRenderer.invoke('nodes:upsertMany', boardId, nodes),
    removeMany: (ids) => ipcRenderer.invoke('nodes:removeMany', ids),
  },
  edges: {
    upsertMany: (boardId, edges) => ipcRenderer.invoke('edges:upsertMany', boardId, edges),
    removeMany: (ids) => ipcRenderer.invoke('edges:removeMany', ids),
  },
  images: {
    store: (payload) => ipcRenderer.invoke('images:store', payload),
    get: (id) => ipcRenderer.invoke('images:get', id),
    pickFile: () => ipcRenderer.invoke('images:pickFile'),
  },
  files: {
    saveText: (payload) => ipcRenderer.invoke('files:saveText', payload),
    openText: (payload) => ipcRenderer.invoke('files:openText', payload),
  },
  onMenu: (channel, cb) => {
    const listener = () => cb();
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  exportPng: (payload) => ipcRenderer.invoke('exportPng', payload),
  exportSvg: (payload) => ipcRenderer.invoke('exportSvg', payload),
  openExternal: (url) => ipcRenderer.invoke('openExternal', url),
  writeClipboard: (text) => ipcRenderer.invoke('writeClipboard', text),
  pickColor: (initial) => ipcRenderer.invoke('pickColor', initial),
  theme: {
    get: () => ipcRenderer.invoke('theme:get'),
    set: (theme) => ipcRenderer.invoke('theme:set', theme),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch) => ipcRenderer.invoke('settings:set', patch),
  },
  vectorize: {
    keyStatus: () => ipcRenderer.invoke('vectorize:keyStatus'),
    run: (req) => ipcRenderer.invoke('vectorize:run', req),
  },
  backups: {
    status: () => ipcRenderer.invoke('backups:status'),
    runNow: () => ipcRenderer.invoke('backups:runNow'),
    reveal: () => ipcRenderer.invoke('backups:reveal'),
  },
};

contextBridge.exposeInMainWorld('haldraw', api);
