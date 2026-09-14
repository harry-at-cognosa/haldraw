import { useCallback, useEffect, useRef, useState } from 'react';
import type { Board, CanvasEdge, CanvasNode, NodeStyle, PickedImageFile, Project } from '@shared/types';
import { DEFAULT_NODE_STYLE, isNodeInteractive, isNodeVisible, layerOrder, useCanvas } from '@/store/canvasStore';
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
import ImportImageModal from '@/panels/ImportImageModal';
import {
  DEFAULT_PLACEMENT,
  decodeAndStore,
  placeImage,
  type DecodedImage,
  type PlacementOptions,
} from '@/util/importImage';
import {
  HALDRAW_FILE_FILTERS,
  buildBoardFile,
  importBoardFile,
  parseBoardFile,
  serializeBoardFile,
  suggestedBoardName,
} from '@/util/haldrawFile';

export default function BoardEditor({
  project,
  board,
  onBack,
  openBoardById,
  pendingImport,
}: {
  project: Project;
  board: Board;
  onBack: () => void;
  openBoardById: (id: string) => Promise<boolean>;
  /** Image chosen in the project picker ("New board from image"); placed once the board is ready. */
  pendingImport?: PickedImageFile | null;
}) {
  const [ready, setReady] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [clipboard, setClipboard] = useState<{ nodes: CanvasNode[]; edges: CanvasEdge[] } | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const saveTimer = useRef<number | null>(null);
  const [importState, setImportState] = useState<{
    image: DecodedImage;
    defaults: PlacementOptions;
  } | null>(null);
  const pendingConsumed = useRef(false);
  const lastSavedLayer = useRef<string | null>(null);

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
    const state = useCanvas.getState();
    const { upserts, deletions, edgeUpserts, edgeDeletions, layerUpserts, layerDeletions } = state.consumeDirty();
    // Layers first so node.layer_id always points at an existing row.
    if (layerUpserts.length) await window.haldraw.layers.upsertMany(board.id, layerUpserts);
    if (upserts.length) await window.haldraw.nodes.upsertMany(board.id, upserts);
    if (deletions.length) await window.haldraw.nodes.removeMany(deletions);
    if (edgeUpserts.length) await window.haldraw.edges.upsertMany(board.id, edgeUpserts);
    if (edgeDeletions.length) await window.haldraw.edges.removeMany(edgeDeletions);
    if (layerDeletions.length) await window.haldraw.layers.removeMany(layerDeletions);
    await window.haldraw.boards.setViewport(board.id, state.viewport);
    if (state.currentLayerId && state.currentLayerId !== lastSavedLayer.current) {
      lastSavedLayer.current = state.currentLayerId;
      await window.haldraw.boards.setCurrentLayer(board.id, state.currentLayerId);
    }
  }, [board.id]);

  // Autosave
  useEffect(() => {
    if (!ready) return;
    const unsub = useCanvas.subscribe((s, prev) => {
      if (
        s.nodes === prev.nodes &&
        s.edges === prev.edges &&
        s.viewport === prev.viewport &&
        s.layers === prev.layers &&
        s.currentLayerId === prev.currentLayerId
      )
        return;
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
      const state = useCanvas.getState();
      const { upserts, deletions, edgeUpserts, edgeDeletions, layerUpserts, layerDeletions } = state.consumeDirty();
      if (layerUpserts.length) window.haldraw.layers.upsertMany(board.id, layerUpserts);
      if (upserts.length) window.haldraw.nodes.upsertMany(board.id, upserts);
      if (deletions.length) window.haldraw.nodes.removeMany(deletions);
      if (edgeUpserts.length) window.haldraw.edges.upsertMany(board.id, edgeUpserts);
      if (edgeDeletions.length) window.haldraw.edges.removeMany(edgeDeletions);
      if (layerDeletions.length) window.haldraw.layers.removeMany(layerDeletions);
      if (state.currentLayerId) window.haldraw.boards.setCurrentLayer(board.id, state.currentLayerId);
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

  /** Decode a picked file and open the placement dialog. */
  const beginImport = useCallback(
    async (picked: PickedImageFile, defaults: Partial<PlacementOptions> = {}) => {
      try {
        const image = await decodeAndStore(picked);
        setImageUrls((m) => ({ ...m, [image.imageId]: image.dataUrl }));
        setImportState({ image, defaults: { ...DEFAULT_PLACEMENT, ...defaults } });
      } catch (err) {
        setToast({ kind: 'err', text: `Import failed: ${(err as Error).message}` });
      }
    },
    []
  );

  /** File ▸ Import Image… and the toolbar button: pick, then place at view centre. */
  const importImageFromFile = useCallback(async () => {
    const picked = await window.haldraw.images.pickFile();
    if (!picked) return;
    await beginImport(picked, { position: 'center' });
  }, [beginImport]);

  const onPlaceImport = useCallback(
    (opts: PlacementOptions) => {
      if (!importState) return;
      placeImage(importState.image, opts, {
        renameDefaultLayerTo: pendingImport && opts.ownLayer ? 'Drawing' : undefined,
      });
      setImportState(null);
      setToast({ kind: 'ok', text: `Placed ${importState.image.name}` });
    },
    [importState, pendingImport]
  );

  // "New board from image": place once the board has loaded.
  useEffect(() => {
    if (!ready || !pendingImport || pendingConsumed.current) return;
    pendingConsumed.current = true;
    beginImport(pendingImport, { position: 'origin' });
  }, [ready, pendingImport, beginImport]);

  // Application menu → File ▸ Import Image…
  useEffect(() => {
    return window.haldraw.onMenu('menu:importImage', () => {
      importImageFromFile();
    });
  }, [importImageFromFile]);

  // Application menu → File ▸ Import Board… : create in this project and open it.
  useEffect(() => {
    return window.haldraw.onMenu('menu:importBoard', async () => {
      try {
        const opened = await window.haldraw.files.openText({ filters: HALDRAW_FILE_FILTERS });
        if (!opened) return;
        const file = parseBoardFile(opened.text);
        await flushSave();
        const created = await importBoardFile(project.id, file, suggestedBoardName(file, opened.name));
        setToast({ kind: 'ok', text: `Imported ${created.name}` });
        await openBoardById(created.id);
      } catch (err) {
        setToast({ kind: 'err', text: `Import failed: ${(err as Error).message}` });
      }
    });
  }, [project.id, flushSave, openBoardById]);

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
    // The view buttons are a canvas aid only. For the capture we force the view
    // that matches the export setting: everything, or everything but locked
    // reference images (Export menu ▸ Include reference images, session-only).
    const store = useCanvas.getState();
    const savedView = store.refView;
    const includeRefs = format === 'haldraw' || store.exportIncludeRefs;
    const captureView = includeRefs ? 'normal' : 'hidden';
    if (savedView !== captureView) {
      store.setRefView(captureView);
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    }
    try {
      await exportWithView(format, includeRefs);
    } finally {
      if (savedView !== captureView) useCanvas.getState().setRefView(savedView);
    }
  };

  const exportWithView = async (format: ExportFormat, includeRefs: boolean) => {
    try {
      const state = useCanvas.getState();
      const allNodes = Object.values(state.nodes);
      const shownNodes = allNodes.filter((n) => isNodeVisible(state, n));
      const nodes = includeRefs ? shownNodes : shownNodes.filter((n) => !n.locked);
      const edges = Object.values(state.edges);
      if (!nodes.length && format !== 'haldraw') {
        setToast({
          kind: 'err',
          text: allNodes.length
            ? 'Only reference images on the board. Tick "Include reference images" in the Export menu.'
            : 'Nothing on the canvas to export.',
        });
        return;
      }
      const safeName = board.name.replace(/[^a-z0-9-_]+/gi, '_');
      if (format === 'haldraw') {
        await flushSave();
        const liveBoard = useCanvas.getState().board ?? board;
        const file = await buildBoardFile(liveBoard, allNodes, edges, Object.values(state.layers));
        const res = await window.haldraw.files.saveText({
          defaultName: `${safeName}.haldraw`,
          text: serializeBoardFile(file),
          filters: HALDRAW_FILE_FILTERS,
        });
        if (res.saved) setToast({ kind: 'ok', text: `Saved ${res.path}` });
        return;
      }
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
      const store = useCanvas.getState();
      if (isTyping() || store.editingNodeId) return;
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

      // Tab / ⇧Tab: step through selectable nodes in stacking order (layer, then z).
      if (e.key === 'Tab' && !meta && !e.altKey) {
        e.preventDefault();
        const pos = new Map(layerOrder(store.layers).map((l, i) => [l.id, i]));
        const order = Object.values(store.nodes)
          .filter((n) => isNodeInteractive(store, n))
          .sort((a, b) => (pos.get(a.layerId) ?? 0) - (pos.get(b.layerId) ?? 0) || a.zIndex - b.zIndex);
        if (!order.length) return;
        const currentId = [...store.selection].find((id) => order.some((n) => n.id === id));
        let i = order.findIndex((n) => n.id === currentId);
        i = e.shiftKey ? (i <= 0 ? order.length - 1 : i - 1) : i >= order.length - 1 ? 0 : i + 1;
        const next = order[i];
        store.select([next.id]);
        ensureInView(next);
        return;
      }
      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if (meta && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        if (store.refView !== 'only')
          store.select(Object.values(store.nodes).filter((n) => isNodeInteractive(store, n)).map((n) => n.id));
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
      if (meta && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        store.addLayer();
        return;
      }
      if (meta && e.altKey && (e.key === ']' || e.code === 'BracketRight')) {
        e.preventDefault();
        store.shiftSelectionLayer('up');
        return;
      }
      if (meta && e.altKey && (e.key === '[' || e.code === 'BracketLeft')) {
        e.preventDefault();
        store.shiftSelectionLayer('down');
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
        onImportImage={importImageFromFile}
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
      <ImportImageModal
        image={importState?.image ?? null}
        defaults={importState?.defaults ?? DEFAULT_PLACEMENT}
        onPlace={onPlaceImport}
        onCancel={() => setImportState(null)}
      />
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

/** Pan (without zooming) so the node is fully on screen, if it is not already. */
function ensureInView(n: CanvasNode) {
  const state = useCanvas.getState();
  const vp = state.viewport;
  const el = document.querySelector('svg.haldraw-canvas') as SVGSVGElement | null;
  const cw = el?.clientWidth ?? 1000;
  const ch = el?.clientHeight ?? 700;
  const pad = 40;
  const left = n.x * vp.zoom + vp.x;
  const top = n.y * vp.zoom + vp.y;
  const right = left + n.width * vp.zoom;
  const bottom = top + n.height * vp.zoom;
  let dx = 0;
  let dy = 0;
  if (left < pad) dx = pad - left;
  else if (right > cw - pad) dx = cw - pad - right;
  if (top < pad) dy = pad - top;
  else if (bottom > ch - pad) dy = ch - pad - bottom;
  // A node larger than the view: centre it instead of thrashing between edges.
  if (right - left > cw - pad * 2) dx = cw / 2 - (left + right) / 2;
  if (bottom - top > ch - pad * 2) dy = ch / 2 - (top + bottom) / 2;
  if (dx || dy) state.setViewport({ x: vp.x + dx, y: vp.y + dy, zoom: vp.zoom });
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
