import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CanvasEdge, CanvasNode, NodeType } from '@shared/types';
import { DEFAULT_NODE_STYLE, useCanvas } from '@/store/canvasStore';
import { combinedBbox, rectsOverlap, type Point } from '@/util/geometry';
import Shape from './Shape';
import Edge from './Edge';
import SelectionLayer, { type Handle } from './SelectionLayer';
import { edgeEndpoints, orthogonalElbow } from './routing';

type Interaction =
  | { kind: 'idle' }
  | { kind: 'pan'; startClient: Point; startViewport: { x: number; y: number } }
  | { kind: 'marquee'; start: Point; current: Point }
  | {
      kind: 'drag-nodes';
      start: Point;
      ids: string[];
      initial: Record<string, { x: number; y: number }>;
    }
  | {
      kind: 'resize';
      handle: Handle;
      start: Point;
      initial: Record<string, CanvasNode>;
      bbox: { x: number; y: number; width: number; height: number };
    }
  | {
      kind: 'rotate';
      start: Point;
      center: Point;
      initial: Record<string, CanvasNode>;
      startAngle: number;
    }
  | {
      kind: 'draw-shape';
      shape: 'rect' | 'square' | 'ellipse' | 'diamond';
      start: Point;
      nodeId: string;
    }
  | {
      kind: 'draw-line';
      arrow: boolean;
      startNodeId: string | null;
      edgeId: string;
      startPoint: Point;
    }
  | {
      kind: 'draw-connector';
      fromNodeId: string;
      edgeId: string;
    }
  | {
      kind: 'drag-edge-endpoint';
      edgeId: string;
      which: 'from' | 'to';
    }
  | {
      kind: 'drag-edge-midpoint';
      edgeId: string;
    }
  | {
      kind: 'drag-edge-label';
      edgeId: string;
    };

export default function Canvas({
  imageUrls,
  onRequestImagePaste,
  onRequestImageFile,
  onOpenLink,
}: {
  imageUrls: Record<string, string>;
  onRequestImagePaste: (blob: Blob, cursor: Point) => void;
  onRequestImageFile: (file: File, cursor: Point) => void;
  onOpenLink: (url: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [interaction, setInteraction] = useState<Interaction>({ kind: 'idle' });
  const [cursorWorld, setCursorWorld] = useState<Point>({ x: 0, y: 0 });
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const nodes = useCanvas((s) => s.nodes);
  const edges = useCanvas((s) => s.edges);
  const selection = useCanvas((s) => s.selection);
  const edgeSelection = useCanvas((s) => s.edgeSelection);
  const tool = useCanvas((s) => s.tool);
  const viewport = useCanvas((s) => s.viewport);
  const showGrid = useCanvas((s) => s.showGrid);
  const snapToGrid = useCanvas((s) => s.snapToGrid);
  const gridSize = useCanvas((s) => s.gridSize);
  const background = useCanvas((s) => s.board?.background ?? '#ffffff');

  const clientToWorld = useCallback(
    (client: Point): Point => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (client.x - rect.left - viewport.x) / viewport.zoom,
        y: (client.y - rect.top - viewport.y) / viewport.zoom,
      };
    },
    [viewport.x, viewport.y, viewport.zoom]
  );

  const maybeSnap = (p: Point): Point =>
    snapToGrid ? { x: Math.round(p.x / gridSize) * gridSize, y: Math.round(p.y / gridSize) * gridSize } : p;

  // Keyboard listener for space = pan
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !isTyping()) {
        setSpacePressed(true);
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpacePressed(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // Wheel: zoom or pan
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const localY = e.clientY - rect.top;
        const delta = -e.deltaY * 0.01;
        useCanvas.getState().zoomAt(localX, localY, delta);
      } else {
        useCanvas.getState().panBy(-e.deltaX, -e.deltaY);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handleNodePointerDown = useCallback(
    (e: React.PointerEvent, node: CanvasNode) => {
      if (editingNodeId) return;
      if (tool === 'connector') {
        e.stopPropagation();
        const edgeId = useCanvas.getState().addEdge({
          fromNode: node.id,
          fromAnchor: 'auto',
          fromPoint: null,
          toNode: null,
          toAnchor: null,
          toPoint: { x: cursorWorld.x, y: cursorWorld.y },
          routing: 'straight',
          arrowStart: false,
          arrowEnd: true,
          style: { stroke: '#e6e8eb', strokeWidth: 2, opacity: 1 },
        }).id;
        setInteraction({ kind: 'draw-connector', fromNodeId: node.id, edgeId });
        (e.target as Element).setPointerCapture(e.pointerId);
        return;
      }
      if (tool !== 'select') return;
      e.stopPropagation();
      if (e.metaKey && node.content.link) {
        onOpenLink(node.content.link);
        return;
      }
      const store = useCanvas.getState();
      const additive = e.shiftKey || e.metaKey;
      const includeGroup = !e.altKey;
      const targets = includeGroup
        ? store.expandSelectionToGroups([node.id])
        : [node.id];
      if (!store.selection.has(node.id)) store.select(targets, { additive });
      const selected = additive
        ? [...store.selection, ...targets.filter((id) => !store.selection.has(id))]
        : targets.length > 1
          ? targets
          : [...store.selection];
      const ids = Array.from(new Set(selected));
      const initial: Record<string, { x: number; y: number }> = {};
      for (const id of ids) {
        const n = store.nodes[id];
        if (n) initial[id] = { x: n.x, y: n.y };
      }
      store.beginTransient();
      const worldStart = clientToWorld({ x: e.clientX, y: e.clientY });
      setInteraction({ kind: 'drag-nodes', start: worldStart, ids, initial });
      (e.target as Element).setPointerCapture(e.pointerId);
    },
    [tool, editingNodeId, cursorWorld, clientToWorld]
  );

  const handleEdgePointerDown = useCallback(
    (e: React.PointerEvent, edge: CanvasEdge) => {
      if (tool !== 'select') return;
      e.stopPropagation();
      useCanvas.getState().select([edge.id], { edges: true, additive: e.shiftKey || e.metaKey });
    },
    [tool]
  );

  const handleHandlePointerDown = useCallback(
    (handle: Handle, e: React.PointerEvent) => {
      e.stopPropagation();
      const store = useCanvas.getState();
      const ids = [...store.selection];
      if (ids.length === 0) return;
      const initial: Record<string, CanvasNode> = {};
      for (const id of ids) {
        const n = store.nodes[id];
        if (n) initial[id] = { ...n };
      }
      const selectedNodes = Object.values(initial);
      const bbox = combinedBbox(selectedNodes);
      if (!bbox) return;
      store.beginTransient();
      const world = clientToWorld({ x: e.clientX, y: e.clientY });
      if (handle === 'rotate') {
        const center = { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
        const startAngle = Math.atan2(world.y - center.y, world.x - center.x);
        setInteraction({ kind: 'rotate', start: world, center, initial, startAngle });
      } else {
        setInteraction({ kind: 'resize', handle, start: world, initial, bbox });
      }
      (e.target as Element).setPointerCapture(e.pointerId);
    },
    [clientToWorld]
  );

  const handleBackgroundPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (editingNodeId) {
        setEditingNodeId(null);
      }
      if (e.button === 1 || spacePressed || tool === 'pan') {
        setInteraction({
          kind: 'pan',
          startClient: { x: e.clientX, y: e.clientY },
          startViewport: { x: viewport.x, y: viewport.y },
        });
        (e.target as Element).setPointerCapture(e.pointerId);
        return;
      }
      const world = clientToWorld({ x: e.clientX, y: e.clientY });
      const store = useCanvas.getState();
      if (tool === 'select') {
        store.clearSelection();
        setInteraction({ kind: 'marquee', start: world, current: world });
        (e.target as Element).setPointerCapture(e.pointerId);
        return;
      }
      if (tool === 'rect' || tool === 'square' || tool === 'ellipse' || tool === 'diamond') {
        const snapped = maybeSnap(world);
        const nodeType: 'rect' | 'ellipse' | 'diamond' =
          tool === 'ellipse' ? 'ellipse' : tool === 'diamond' ? 'diamond' : 'rect';
        const node = store.addNode({
          type: nodeType,
          x: snapped.x,
          y: snapped.y,
          width: 1,
          height: 1,
          rotation: 0,
          style: { ...DEFAULT_NODE_STYLE },
          content: {},
        });
        setInteraction({ kind: 'draw-shape', shape: tool, start: snapped, nodeId: node.id });
        (e.target as Element).setPointerCapture(e.pointerId);
        return;
      }
      if (tool === 'line' || tool === 'arrow') {
        const snapped = maybeSnap(world);
        const startNode = findTopmostNodeAt(store.nodes, world);
        const edge = store.addEdge({
          fromNode: startNode?.id ?? null,
          fromAnchor: startNode ? 'auto' : null,
          fromPoint: startNode ? null : { x: snapped.x, y: snapped.y },
          toNode: null,
          toAnchor: null,
          toPoint: { x: snapped.x, y: snapped.y },
          routing: 'straight',
          arrowStart: false,
          arrowEnd: tool === 'arrow',
          style: { stroke: '#e6e8eb', strokeWidth: 2, opacity: 1 },
        });
        setInteraction({
          kind: 'draw-line',
          arrow: tool === 'arrow',
          startNodeId: startNode?.id ?? null,
          edgeId: edge.id,
          startPoint: snapped,
        });
        (e.target as Element).setPointerCapture(e.pointerId);
        return;
      }
      if (tool === 'text') {
        const snapped = maybeSnap(world);
        const node = store.addNode({
          type: 'text',
          x: snapped.x - 60,
          y: snapped.y - 14,
          width: 120,
          height: 28,
          rotation: 0,
          style: { ...DEFAULT_NODE_STYLE, fill: 'transparent', stroke: 'transparent' },
          content: { text: '' },
        });
        store.select([node.id]);
        store.setTool('select');
        setEditingNodeId(node.id);
      }
    },
    [editingNodeId, spacePressed, tool, viewport.x, viewport.y, clientToWorld, snapToGrid, gridSize]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const world = clientToWorld({ x: e.clientX, y: e.clientY });
      setCursorWorld(world);
      const store = useCanvas.getState();
      switch (interaction.kind) {
        case 'pan': {
          store.setViewport({
            x: interaction.startViewport.x + (e.clientX - interaction.startClient.x),
            y: interaction.startViewport.y + (e.clientY - interaction.startClient.y),
            zoom: viewport.zoom,
          });
          return;
        }
        case 'marquee': {
          setInteraction({ ...interaction, current: world });
          return;
        }
        case 'drag-nodes': {
          const dx = world.x - interaction.start.x;
          const dy = world.y - interaction.start.y;
          store.updateNodes(interaction.ids, (n) => {
            const init = interaction.initial[n.id];
            if (!init) return;
            const p = maybeSnap({ x: init.x + dx, y: init.y + dy });
            n.x = p.x;
            n.y = p.y;
          });
          return;
        }
        case 'resize': {
          const dx = world.x - interaction.start.x;
          const dy = world.y - interaction.start.y;
          const h = interaction.handle;
          let left = interaction.bbox.x;
          let top = interaction.bbox.y;
          let right = interaction.bbox.x + interaction.bbox.width;
          let bottom = interaction.bbox.y + interaction.bbox.height;
          if (h.includes('w')) left = Math.min(interaction.bbox.x + dx, right - 4);
          if (h.includes('e')) right = Math.max(interaction.bbox.x + interaction.bbox.width + dx, left + 4);
          if (h.includes('n')) top = Math.min(interaction.bbox.y + dy, bottom - 4);
          if (h.includes('s')) bottom = Math.max(interaction.bbox.y + interaction.bbox.height + dy, top + 4);
          const newW = right - left;
          const newH = bottom - top;
          const scaleX = newW / interaction.bbox.width;
          const scaleY = newH / interaction.bbox.height;
          store.updateNodes(Object.keys(interaction.initial), (n) => {
            const init = interaction.initial[n.id];
            if (!init) return;
            n.x = left + (init.x - interaction.bbox.x) * scaleX;
            n.y = top + (init.y - interaction.bbox.y) * scaleY;
            n.width = Math.max(1, init.width * scaleX);
            n.height = Math.max(1, init.height * scaleY);
          });
          return;
        }
        case 'rotate': {
          const angle = Math.atan2(world.y - interaction.center.y, world.x - interaction.center.x);
          let delta = angle - interaction.startAngle;
          if (e.shiftKey) {
            const step = Math.PI / 12;
            delta = Math.round(delta / step) * step;
          }
          store.updateNodes(Object.keys(interaction.initial), (n) => {
            const init = interaction.initial[n.id];
            if (!init) return;
            n.rotation = init.rotation + delta;
          });
          return;
        }
        case 'draw-shape': {
          const snapped = maybeSnap(world);
          const startSnapped = interaction.start;
          let x = Math.min(startSnapped.x, snapped.x);
          let y = Math.min(startSnapped.y, snapped.y);
          let w = Math.abs(snapped.x - startSnapped.x);
          let h = Math.abs(snapped.y - startSnapped.y);
          if (interaction.shape === 'square' || e.shiftKey) {
            const s = Math.max(w, h);
            w = s;
            h = s;
            if (snapped.x < startSnapped.x) x = startSnapped.x - s;
            if (snapped.y < startSnapped.y) y = startSnapped.y - s;
          }
          store.updateNodes([interaction.nodeId], (n) => {
            n.x = x;
            n.y = y;
            n.width = Math.max(1, w);
            n.height = Math.max(1, h);
          });
          return;
        }
        case 'draw-line': {
          const snapped = maybeSnap(world);
          const target = findTopmostNodeAt(store.nodes, world, interaction.startNodeId);
          setHoveredNodeId(target?.id ?? null);
          store.updateEdges([interaction.edgeId], (edge) => {
            if (target) {
              edge.toNode = target.id;
              edge.toAnchor = 'auto';
              edge.toPoint = null;
            } else {
              edge.toNode = null;
              edge.toAnchor = null;
              edge.toPoint = snapped;
            }
          });
          return;
        }
        case 'draw-connector': {
          // Track hovered node for snapping
          const target = findTopmostNodeAt(store.nodes, world, interaction.fromNodeId);
          setHoveredNodeId(target?.id ?? null);
          store.updateEdges([interaction.edgeId], (edge) => {
            if (target) {
              edge.toNode = target.id;
              edge.toAnchor = 'auto';
              edge.toPoint = null;
            } else {
              edge.toNode = null;
              edge.toAnchor = null;
              edge.toPoint = world;
            }
          });
          return;
        }
        case 'drag-edge-midpoint': {
          store.updateEdges([interaction.edgeId], (ed) => {
            ed.midpoint = { x: world.x, y: world.y };
          });
          return;
        }
        case 'drag-edge-label': {
          store.updateEdges([interaction.edgeId], (ed) => {
            ed.labelPoint = { x: world.x, y: world.y };
          });
          return;
        }
        case 'drag-edge-endpoint': {
          const edge = store.edges[interaction.edgeId];
          if (!edge) return;
          const otherId = interaction.which === 'from' ? edge.toNode : edge.fromNode;
          const target = findTopmostNodeAt(store.nodes, world, otherId);
          setHoveredNodeId(target?.id ?? null);
          store.updateEdges([interaction.edgeId], (ed) => {
            if (interaction.which === 'from') {
              if (target) {
                ed.fromNode = target.id;
                ed.fromAnchor = 'auto';
                ed.fromPoint = null;
              } else {
                ed.fromNode = null;
                ed.fromAnchor = null;
                ed.fromPoint = world;
              }
            } else {
              if (target) {
                ed.toNode = target.id;
                ed.toAnchor = 'auto';
                ed.toPoint = null;
              } else {
                ed.toNode = null;
                ed.toAnchor = null;
                ed.toPoint = world;
              }
            }
          });
          return;
        }
      }
    },
    [interaction, clientToWorld, viewport.zoom]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const store = useCanvas.getState();
      switch (interaction.kind) {
        case 'marquee': {
          const r = normalizeRect(interaction.start, interaction.current);
          const hit = Object.values(store.nodes).filter((n) =>
            rectsOverlap(r, { x: n.x, y: n.y, width: n.width, height: n.height })
          );
          if (hit.length) store.select(hit.map((n) => n.id));
          break;
        }
        case 'drag-nodes':
        case 'resize':
        case 'rotate':
          store.endTransient();
          break;
        case 'draw-shape': {
          const n = store.nodes[interaction.nodeId];
          if (n && (n.width < 4 || n.height < 4)) {
            store.deleteNodes([interaction.nodeId]);
          } else {
            store.select([interaction.nodeId]);
          }
          store.setTool('select');
          break;
        }
        case 'draw-line': {
          const edge = store.edges[interaction.edgeId];
          if (!edge) break;
          const attached = Boolean(edge.fromNode || edge.toNode);
          const len = edge.fromPoint && edge.toPoint
            ? Math.hypot(edge.toPoint.x - edge.fromPoint.x, edge.toPoint.y - edge.fromPoint.y)
            : 0;
          if (!attached && len < 4) store.deleteEdges([interaction.edgeId]);
          else if (edge.fromNode && edge.toNode && edge.fromNode === edge.toNode) {
            store.deleteEdges([interaction.edgeId]);
          } else {
            store.select([interaction.edgeId], { edges: true });
          }
          setHoveredNodeId(null);
          store.setTool('select');
          break;
        }
        case 'draw-connector': {
          const edge = store.edges[interaction.edgeId];
          if (!edge || !edge.toNode || edge.toNode === edge.fromNode) {
            store.deleteEdges([interaction.edgeId]);
          } else {
            store.select([interaction.edgeId], { edges: true });
          }
          setHoveredNodeId(null);
          store.setTool('select');
          break;
        }
        case 'drag-edge-endpoint': {
          store.endTransient();
          setHoveredNodeId(null);
          break;
        }
        case 'drag-edge-midpoint':
        case 'drag-edge-label':
          store.endTransient();
          break;
      }
      setInteraction({ kind: 'idle' });
      try {
        (e.target as Element).releasePointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }
    },
    [interaction]
  );

  // Clipboard paste for images
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            onRequestImagePaste(blob, cursorWorld);
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [cursorWorld, onRequestImagePaste]);

  // Drag-and-drop image files
  const onDragOver = (e: React.DragEvent) => {
    if (Array.from(e.dataTransfer.items).some((i) => i.kind === 'file')) {
      e.preventDefault();
    }
  };
  const onDrop = (e: React.DragEvent) => {
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    e.preventDefault();
    const world = clientToWorld({ x: e.clientX, y: e.clientY });
    files.forEach((f, i) => onRequestImageFile(f, { x: world.x + i * 30, y: world.y + i * 30 }));
  };

  const sortedNodes = useMemo(
    () => Object.values(nodes).sort((a, b) => a.zIndex - b.zIndex),
    [nodes]
  );
  const sortedEdges = useMemo(() => Object.values(edges), [edges]);
  const selectedNodes = useMemo(
    () => [...selection].map((id) => nodes[id]).filter(Boolean),
    [nodes, selection]
  );
  const selectedEdgeId = edgeSelection.size === 1 ? [...edgeSelection][0] : null;
  const selectedEdge = selectedEdgeId ? edges[selectedEdgeId] : null;
  const selectedEdgeEndpoints = useMemo(() => {
    if (!selectedEdge) return null;
    return edgeEndpoints(selectedEdge, nodes);
  }, [selectedEdge, nodes]);

  const startEndpointDrag = (which: 'from' | 'to', e: React.PointerEvent) => {
    if (!selectedEdge) return;
    e.stopPropagation();
    useCanvas.getState().beginTransient();
    setInteraction({ kind: 'drag-edge-endpoint', edgeId: selectedEdge.id, which });
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const startMidpointDrag = (e: React.PointerEvent) => {
    if (!selectedEdge) return;
    e.stopPropagation();
    useCanvas.getState().beginTransient();
    setInteraction({ kind: 'drag-edge-midpoint', edgeId: selectedEdge.id });
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const startLabelDrag = (e: React.PointerEvent) => {
    if (!selectedEdge) return;
    e.stopPropagation();
    useCanvas.getState().beginTransient();
    setInteraction({ kind: 'drag-edge-label', edgeId: selectedEdge.id });
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const orthoElbow =
    selectedEdge && selectedEdge.routing === 'orthogonal'
      ? orthogonalElbow(selectedEdge, nodes)
      : null;

  const marqueeRect = interaction.kind === 'marquee' ? normalizeRect(interaction.start, interaction.current) : null;
  const isTransparent = background === 'transparent';
  const checkerStyle: React.CSSProperties = isTransparent
    ? {
        backgroundImage:
          'linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)',
        backgroundSize: '20px 20px',
        backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0',
        backgroundColor: '#222',
      }
    : { backgroundColor: background };

  const gridStyle: React.CSSProperties = showGrid
    ? {
        backgroundImage: `radial-gradient(${isBgDark(background) ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'} 1px, transparent 1px)`,
        backgroundSize: `${20 * viewport.zoom}px ${20 * viewport.zoom}px`,
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
      }
    : {};

  const cursor =
    spacePressed || tool === 'pan'
      ? interaction.kind === 'pan'
        ? 'grabbing'
        : 'grab'
      : tool === 'select'
        ? 'default'
        : 'crosshair';

  return (
    <div
      className="w-full h-full relative"
      style={{ ...checkerStyle, cursor }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {showGrid && !isTransparent ? (
        <div className="absolute inset-0 pointer-events-none" style={gridStyle} />
      ) : null}
      <svg
        ref={svgRef}
        className="w-full h-full haldraw-canvas"
        onPointerDown={handleBackgroundPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ touchAction: 'none' }}
      >
        <g data-root="true" transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}>
          {sortedEdges.map((edge) => (
            <Edge
              key={edge.id}
              edge={edge}
              nodes={nodes}
              selected={edgeSelection.has(edge.id)}
              onPointerDown={handleEdgePointerDown}
              onLabelPointerDown={(e) => {
                if (edgeSelection.has(edge.id)) {
                  useCanvas.getState().select([edge.id], { edges: true });
                  startLabelDrag(e);
                }
              }}
            />
          ))}
          {sortedNodes.map((node) => (
            <Shape
              key={node.id}
              node={node}
              selected={selection.has(node.id)}
              onPointerDown={handleNodePointerDown}
              onDoubleClick={(n) => {
                if (
                  n.type === 'text' ||
                  n.type === 'rect' ||
                  n.type === 'ellipse' ||
                  n.type === 'diamond'
                ) {
                  setEditingNodeId(n.id);
                  useCanvas.getState().select([n.id]);
                }
              }}
              editing={editingNodeId === node.id}
              onFinishEdit={(text) => {
                useCanvas.getState().updateNodes([node.id], (n) => {
                  n.content = { ...n.content, text };
                });
                useCanvas.getState().commit();
                setEditingNodeId(null);
              }}
              imageUrl={node.content.imageId ? imageUrls[node.content.imageId] : undefined}
            />
          ))}
          <g data-ui="true">
            {sortedNodes
              .filter((n) => !!n.content.link)
              .map((n) => {
                const s = 20 / viewport.zoom;
                const bx = n.x + n.width - s * 0.3;
                const by = n.y - s * 0.7;
                return (
                  <g
                    key={`link-${n.id}`}
                    transform={`translate(${bx} ${by})`}
                    style={{ cursor: 'pointer' }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      if (n.content.link) onOpenLink(n.content.link);
                    }}
                  >
                    <rect
                      x={0}
                      y={0}
                      width={s}
                      height={s}
                      rx={s / 4}
                      fill="var(--accent)"
                      stroke="white"
                      strokeWidth={1 / viewport.zoom}
                    />
                    <g transform={`scale(${s / 20})`}>
                      <path
                        d="M6 14 L14 6 M8 6 L14 6 L14 12"
                        fill="none"
                        stroke="white"
                        strokeWidth={2.25}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                  </g>
                );
              })}
          </g>
          {selectedNodes.length > 0 && interaction.kind !== 'marquee' && interaction.kind !== 'draw-shape' ? (
            <g data-ui="true">
            <SelectionLayer
              nodes={selectedNodes}
              zoom={viewport.zoom}
              onHandlePointerDown={handleHandlePointerDown}
            />
            </g>
          ) : null}
          {marqueeRect ? (
            <rect
              data-ui="true"
              x={marqueeRect.x}
              y={marqueeRect.y}
              width={marqueeRect.width}
              height={marqueeRect.height}
              fill="var(--accent-soft)"
              stroke="var(--accent)"
              strokeWidth={1 / viewport.zoom}
              pointerEvents="none"
            />
          ) : null}
          {selectedEdgeEndpoints && interaction.kind === 'idle' ? (
            <g data-ui="true">
              {(['from', 'to'] as const).map((which) => {
                const p = which === 'from' ? selectedEdgeEndpoints.from : selectedEdgeEndpoints.to;
                const attached = which === 'from' ? Boolean(selectedEdge?.fromNode) : Boolean(selectedEdge?.toNode);
                const r = 7 / viewport.zoom;
                return (
                  <circle
                    key={which}
                    cx={p.x}
                    cy={p.y}
                    r={r}
                    fill={attached ? 'var(--accent)' : 'white'}
                    stroke="var(--accent)"
                    strokeWidth={2 / viewport.zoom}
                    style={{ cursor: 'grab' }}
                    onPointerDown={(e) => startEndpointDrag(which, e)}
                  />
                );
              })}
              {orthoElbow ? (
                <rect
                  x={orthoElbow.x - 6 / viewport.zoom}
                  y={orthoElbow.y - 6 / viewport.zoom}
                  width={12 / viewport.zoom}
                  height={12 / viewport.zoom}
                  rx={3 / viewport.zoom}
                  fill="white"
                  stroke="var(--accent)"
                  strokeWidth={2 / viewport.zoom}
                  style={{ cursor: 'move' }}
                  onPointerDown={startMidpointDrag}
                />
              ) : null}
            </g>
          ) : null}
          {hoveredNodeId && nodes[hoveredNodeId] ? (
            <rect
              data-ui="true"
              x={nodes[hoveredNodeId].x - 4 / viewport.zoom}
              y={nodes[hoveredNodeId].y - 4 / viewport.zoom}
              width={nodes[hoveredNodeId].width + 8 / viewport.zoom}
              height={nodes[hoveredNodeId].height + 8 / viewport.zoom}
              rx={(nodes[hoveredNodeId].style.cornerRadius ?? 8) + 4 / viewport.zoom}
              fill="var(--accent)"
              fillOpacity={0.18}
              stroke="var(--accent)"
              strokeWidth={3 / viewport.zoom}
              pointerEvents="none"
            />
          ) : null}
        </g>
      </svg>
    </div>
  );
}

function normalizeRect(a: Point, b: Point) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

function findTopmostNodeAt(
  nodes: Record<string, CanvasNode>,
  p: Point,
  excludeId?: string | null
): CanvasNode | null {
  const sorted = Object.values(nodes).sort((a, b) => b.zIndex - a.zIndex);
  for (const n of sorted) {
    if (n.id === excludeId) continue;
    if (p.x >= n.x && p.x <= n.x + n.width && p.y >= n.y && p.y <= n.y + n.height) {
      return n;
    }
  }
  return null;
}

function isBgDark(c: string): boolean {
  if (c === 'transparent') return true;
  const m = c.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum < 128;
}

function isTyping(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable;
}
