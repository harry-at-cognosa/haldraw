import { useCallback, useEffect, useRef, useState } from 'react';
import type { Board, CanvasEdge, CanvasNode, NodeStyle, Project } from '@shared/types';
import { DEFAULT_NODE_STYLE, useCanvas } from '@/store/canvasStore';
import { combinedBbox, type Point } from '@/util/geometry';
import { newId } from '@/util/id';
import Canvas from './Canvas';
import Toolbar from '@/panels/Toolbar';
import PropertiesPanel from '@/panels/PropertiesPanel';
import IconPicker from '@/panels/IconPicker';
import Minimap from '@/panels/Minimap';
import ShortcutHelp from '@/panels/ShortcutHelp';
import { exportBoardPng, buildExportSvg } from '@/util/exportPng';
import type { ExportFormat } from '@/panels/ExportMenu';

export default function BoardEditor({
  project,
  board,
  onBack,
  openBoardById,
}: {
  project: Project;
  board: Board;
  onBack: () => void;
  openBoardById: (id: string) => Promise<boolean>;
}) {
  const [ready, setReady] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [clipboard, setClipboard] = useState<{ nodes: CanvasNode[]; edges: CanvasEdge[] } | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Load board
  useEffect(() => {
    (async () => {
      const snapshot = await window.haldraw.boards.load(board.id);
      if (!snapshot) return;
      useCanvas.getState().hydrate(snapshot);
      // Preload images
      const ids = new Set<string>();
      for (const n of snapshot.nodes) if (n.content.imageId) ids.add(n.content.imageId);
      const urls: Record<string, string> = {};
      for (const id of ids) {
        const blob = await window.haldraw.images.get(id);
        if (blob) urls[id] = blob.dataUrl;
      }
      setImageUrls(urls);
      setReady(true);
    })();
    return () => useCanvas.getState().clear();
  }, [board.id]);

  // Theme
  useEffect(() => {
    window.haldraw.theme.get().then(setTheme);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  const flushSave = useCallback(async () => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const { upserts, deletions, edgeUpserts, edgeDeletions } = useCanvas.getState().consumeDirty();
    if (upserts.length) await window.haldraw.nodes.upsertMany(board.id, upserts);
    if (deletions.length) await window.haldraw.nodes.removeMany(deletions);
    if (edgeUpserts.length) await window.haldraw.edges.upsertMany(board.id, edgeUpserts);
    if (edgeDeletions.length) await window.haldraw.edges.removeMany(edgeDeletions);
    await window.haldraw.boards.setViewport(board.id, useCanvas.getState().viewport);
  }, [board.id]);

  // Autosave
  useEffect(() => {
    if (!ready) return;
    const unsub = useCanvas.subscribe((s, prev) => {
      if (s.nodes === prev.nodes && s.edges === prev.edges && s.viewport === prev.viewport) return;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        flushSave();
      }, 300);
    });
    return () => unsub();
  }, [ready, flushSave]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      const { upserts, deletions, edgeUpserts, edgeDeletions } = useCanvas.getState().consumeDirty();
      if (upserts.length) window.haldraw.nodes.upsertMany(board.id, upserts);
      if (deletions.length) window.haldraw.nodes.removeMany(deletions);
      if (edgeUpserts.length) window.haldraw.edges.upsertMany(board.id, edgeUpserts);
      if (edgeDeletions.length) window.haldraw.edges.removeMany(edgeDeletions);
    };
  }, [board.id]);

  const onRequestImagePaste = useCallback(
    async (blob: Blob, cursor: Point) => {
      const bytes = await blob.arrayBuffer();
      const img = await blobToImage(blob);
      const id = await window.haldraw.images.store({
        mime: blob.type,
        bytes,
        width: img.width,
        height: img.height,
      });
      const maxSide = 400;
      const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = img.width * ratio;
      const h = img.height * ratio;
      useCanvas.getState().addNode({
        type: 'image',
        x: cursor.x - w / 2,
        y: cursor.y - h / 2,
        width: w,
        height: h,
        rotation: 0,
        style: { opacity: 1 },
        content: { imageId: id },
      });
      const dataUrl = await blobToDataUrl(blob);
      setImageUrls((m) => ({ ...m, [id]: dataUrl }));
    },
    []
  );

  const onRequestImageFile = useCallback((file: File, cursor: Point) => {
    onRequestImagePaste(file, cursor);
  }, [onRequestImagePaste]);

  const onOpenLink = useCallback(
    async (url: string) => {
      try {
        const internal = url.match(/^haldraw:\/\/board\/([A-Za-z0-9]+)/);
        if (internal) {
          await flushSave();
          const ok = await openBoardById(internal[1]);
          if (!ok) setToast({ kind: 'err', text: 'Linked board not found.' });
          return;
        }
        if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) {
          await window.haldraw.openExternal(url);
          return;
        }
        setToast({ kind: 'err', text: `Unrecognized link: ${url}` });
      } catch (err) {
        setToast({ kind: 'err', text: `Link failed: ${(err as Error).message}` });
      }
    },
    [openBoardById]
  );

  const onPickIcon = (name: string) => {
    const vp = useCanvas.getState().viewport;
    const el = document.querySelector('svg');
    const cw = (el?.clientWidth ?? 1000) / 2;
    const ch = (el?.clientHeight ?? 700) / 2;
    const cx = (cw - vp.x) / vp.zoom;
    const cy = (ch - vp.y) / vp.zoom;
    const size = 64;
    useCanvas.getState().addNode({
      type: 'icon',
      x: cx - size / 2,
      y: cy - size / 2,
      width: size,
      height: size,
      rotation: 0,
      style: { color: '#e6e8eb', strokeWidth: 2, opacity: 1 },
      content: { iconName: name },
    });
  };

  const onToggleTheme = async () => {
    const next: 'dark' | 'light' = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    await window.haldraw.theme.set(next);
  };

  const onExport = async (format: ExportFormat) => {
    try {
      const state = useCanvas.getState();
      const nodes = Object.values(state.nodes);
      const edges = Object.values(state.edges);
      if (!nodes.length) {
        setToast({ kind: 'err', text: 'Nothing on the canvas to export.' });
        return;
      }
      const safeName = board.name.replace(/[^a-z0-9-_]+/gi, '_');
      const boardBg = useCanvas.getState().board?.background ?? '#ffffff';
      const solidBg = boardBg === 'transparent' ? '#ffffff' : boardBg;
      if (format === 'svg') {
        const xml = buildExportSvg({ nodes, background: null });
        const res = await window.haldraw.exportSvg({ defaultName: `${safeName}.svg`, xml });
        if (res.saved) setToast({ kind: 'ok', text: `Saved ${res.path}` });
      } else {
        const bg = format === 'png-solid' ? solidBg : null;
        const dataUrl = await exportBoardPng({ nodes, edges, imageUrls, background: bg });
        const res = await window.haldraw.exportPng({ defaultName: `${safeName}.png`, dataUrl });
        if (res.saved) setToast({ kind: 'ok', text: `Saved ${res.path}` });
      }
    } catch (err) {
      console.error('export failed', err);
      setToast({ kind: 'err', text: `Export failed: ${(err as Error).message}` });
    }
  };

  const zoomToFit = useCallback(() => {
    const state = useCanvas.getState();
    const all = Object.values(state.nodes);
    if (!all.length) {
      state.setViewport({ x: 0, y: 0, zoom: 1 });
      return;
    }
    const bbox = combinedBbox(all)!;
    const el = document.querySelector('svg');
    const cw = el?.clientWidth ?? 1000;
    const ch = el?.clientHeight ?? 800;
    const pad = 80;
    const zoom = Math.min((cw - pad * 2) / bbox.width, (ch - pad * 2) / bbox.height, 4);
    state.setViewport({
      x: cw / 2 - (bbox.x + bbox.width / 2) * zoom,
      y: ch / 2 - (bbox.y + bbox.height / 2) * zoom,
      zoom,
    });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      if (isTyping()) return;
      const store = useCanvas.getState();
      const meta = e.metaKey || e.ctrlKey;

      // Simple tool keys
      if (!meta && !e.altKey) {
        const key = e.key.toLowerCase();
        const map: Record<string, () => void> = {
          v: () => store.setTool('select'),
          r: () => store.setTool('rect'),
          s: () => store.setTool('square'),
          o: () => store.setTool('ellipse'),
          d: () => store.setTool('diamond'),
          l: () => store.setTool('line'),
          a: () => store.setTool('arrow'),
          t: () => store.setTool('text'),
          c: () => store.setTool('connector'),
          i: () => setIconPickerOpen(true),
          '?': () => setShortcutsOpen((v) => !v),
        };
        if (map[key]) {
          e.preventDefault();
          map[key]();
          return;
        }
      }

      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if (meta && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        store.select(Object.keys(store.nodes));
        return;
      }
      if (meta && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (e.shiftKey) {
          duplicateCurrentBoard();
        } else {
          duplicateSelection();
        }
        return;
      }
      if (meta && e.key.toLowerCase() === 'c') {
        if ((e.target as HTMLElement)?.isContentEditable) return;
        e.preventDefault();
        const selected = [...store.selection].map((id) => store.nodes[id]).filter(Boolean) as CanvasNode[];
        const sEdges = [...store.edgeSelection].map((id) => store.edges[id]).filter(Boolean) as CanvasEdge[];
        setClipboard({ nodes: selected, edges: sEdges });
        return;
      }
      if (meta && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        const selected = [...store.selection].map((id) => store.nodes[id]).filter(Boolean) as CanvasNode[];
        setClipboard({ nodes: selected, edges: [] });
        store.deleteNodes(selected.map((n) => n.id));
        return;
      }
      if (meta && e.key.toLowerCase() === 'v') {
        if (clipboard && clipboard.nodes.length) {
          e.preventDefault();
          pasteClipboard();
        }
        return;
      }
      if (meta && e.key === '0') {
        e.preventDefault();
        store.setViewport({ ...store.viewport, zoom: 1 });
        return;
      }
      if (meta && e.key === '1') {
        e.preventDefault();
        zoomToFit();
        return;
      }
      if (meta && e.key === ']') {
        e.preventDefault();
        const ids = [...store.selection];
        if (e.shiftKey) store.bringToFront(ids);
        else store.bringForward(ids);
        return;
      }
      if (meta && e.key === '[') {
        e.preventDefault();
        const ids = [...store.selection];
        if (e.shiftKey) store.sendToBack(ids);
        else store.sendBackward(ids);
        return;
      }
      if (meta && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        onExport('png-transparent');
        return;
      }
      if (meta && e.key.toLowerCase() === 's') {
        e.preventDefault();
        flushSave().then(() => setToast({ kind: 'ok', text: 'Saved' }));
        return;
      }
      if (meta && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (e.shiftKey) store.ungroupSelection();
        else store.groupSelection();
        return;
      }
      if (e.key === 'Escape') {
        store.clearSelection();
        store.setTool('select');
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selNodes = [...store.selection];
        const selEdges = [...store.edgeSelection];
        if (selNodes.length || selEdges.length) {
          e.preventDefault();
          if (selNodes.length) store.deleteNodes(selNodes);
          if (selEdges.length) store.deleteEdges(selEdges);
        }
        return;
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        const ids = [...store.selection];
        if (ids.length) {
          e.preventDefault();
          store.beginTransient();
          store.updateNodes(ids, (n) => {
            n.x += dx;
            n.y += dy;
          });
          store.endTransient();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [clipboard, zoomToFit]);

  const duplicateCurrentBoard = async () => {
    try {
      await flushSave();
      const stamp = boardTimestamp();
      const newName = `${board.name} (copy ${stamp})`;
      const copy = await window.haldraw.boards.duplicate(board.id, newName);
      if (copy) setToast({ kind: 'ok', text: `Saved copy: ${newName}` });
    } catch (err) {
      setToast({ kind: 'err', text: `Copy failed: ${(err as Error).message}` });
    }
  };

  const duplicateSelection = () => {
    const store = useCanvas.getState();
    const selectedNodes = [...store.selection].map((id) => store.nodes[id]).filter(Boolean) as CanvasNode[];
    if (!selectedNodes.length) return;
    const idMap: Record<string, string> = {};
    const newIds: string[] = [];
    for (const n of selectedNodes) {
      const nid = newId();
      idMap[n.id] = nid;
      newIds.push(nid);
      store.addNode({
        type: n.type,
        x: n.x + 20,
        y: n.y + 20,
        width: n.width,
        height: n.height,
        rotation: n.rotation,
        style: { ...n.style },
        content: { ...n.content },
      });
    }
    store.select(newIds);
  };

  const pasteClipboard = () => {
    if (!clipboard) return;
    const store = useCanvas.getState();
    const idMap: Record<string, string> = {};
    const newNodes: CanvasNode[] = [];
    for (const n of clipboard.nodes) {
      const node = store.addNode({
        type: n.type,
        x: n.x + 20,
        y: n.y + 20,
        width: n.width,
        height: n.height,
        rotation: n.rotation,
        style: { ...n.style },
        content: { ...n.content },
      });
      idMap[n.id] = node.id;
      newNodes.push(node);
    }
    for (const e of clipboard.edges) {
      if (e.fromNode && !idMap[e.fromNode]) continue;
      if (e.toNode && !idMap[e.toNode]) continue;
      store.addEdge({
        fromNode: e.fromNode ? idMap[e.fromNode] : null,
        fromAnchor: e.fromAnchor,
        fromPoint: e.fromPoint,
        toNode: e.toNode ? idMap[e.toNode] : null,
        toAnchor: e.toAnchor,
        toPoint: e.toPoint,
        routing: e.routing,
        arrowStart: e.arrowStart,
        arrowEnd: e.arrowEnd,
        style: { ...e.style },
        label: e.label,
      });
    }
    store.select(newNodes.map((n) => n.id));
  };

  if (!ready) {
    return (
      <div className="h-full w-full bg-canvas flex items-center justify-center text-fg-muted">
        Loading…
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-canvas text-fg">
      <Toolbar
        title={`${project.name} › ${board.name}`}
        onExport={onExport}
        onOpenIcons={() => setIconPickerOpen(true)}
        onBack={onBack}
        onShortcuts={() => setShortcutsOpen(true)}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 relative">
          <Canvas
            imageUrls={imageUrls}
            onRequestImagePaste={onRequestImagePaste}
            onRequestImageFile={onRequestImageFile}
            onOpenLink={onOpenLink}
          />
          <Minimap />
        </div>
        <PropertiesPanel />
      </div>
      <IconPicker open={iconPickerOpen} onClose={() => setIconPickerOpen(false)} onPick={onPickIcon} />
      <ShortcutHelp open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      {toast ? (
        <div
          className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-panel text-sm border ${
            toast.kind === 'ok'
              ? 'bg-panel border-border text-fg'
              : 'bg-red-500/90 border-red-400 text-white'
          }`}
        >
          {toast.text}
        </div>
      ) : null}
    </div>
  );
}

function isTyping(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable;
}

async function blobToImage(blob: Blob): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function boardTimestamp(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd} ${hh}${mi}`;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
