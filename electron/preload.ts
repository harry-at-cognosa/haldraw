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
    create: (projectId, name) => ipcRenderer.invoke('boards:create', projectId, name),
    rename: (id, name) => ipcRenderer.invoke('boards:rename', id, name),
    remove: (id) => ipcRenderer.invoke('boards:remove', id),
    duplicate: (id, newName) => ipcRenderer.invoke('boards:duplicate', id, newName),
    load: (id) => ipcRenderer.invoke('boards:load', id),
    setViewport: (id, viewport) => ipcRenderer.invoke('boards:setViewport', id, viewport),
    setBackground: (id, background) => ipcRenderer.invoke('boards:setBackground', id, background),
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
  },
  exportPng: (payload) => ipcRenderer.invoke('exportPng', payload),
  exportSvg: (payload) => ipcRenderer.invoke('exportSvg', payload),
  theme: {
    get: () => ipcRenderer.invoke('theme:get'),
    set: (theme) => ipcRenderer.invoke('theme:set', theme),
  },
};

contextBridge.exposeInMainWorld('haldraw', api);
