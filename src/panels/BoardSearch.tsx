import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { isEdgeVisible, isNodeVisible, layerOrder, useCanvas } from '@/store/canvasStore';
import { ensureRectInView } from '@/util/view';
import { edgeEndpoints } from '@/canvas/routing';

type Hit = { kind: 'node' | 'edge'; id: string; text: string };

/**
 * ⌘F: find shapes (and line labels) on this board by text. Case-insensitive
 * substring; matches are listed in stacking order. The current hit is selected
 * and panned into view; every hit is outlined on the canvas while the bar is
 * open. ↩ / ↓ next, ⇧↩ / ↑ previous, esc closes and keeps the selection.
 */
export default function BoardSearch({ onClose }: { onClose: () => void }) {
  const nodes = useCanvas((s) => s.nodes);
  const edges = useCanvas((s) => s.edges);
  const layers = useCanvas((s) => s.layers);
  const soloLayerId = useCanvas((s) => s.soloLayerId);
  const setSearchHits = useCanvas((s) => s.setSearchHits);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 10);
    return () => setSearchHits([]);
  }, [setSearchHits]);

  const hits = useMemo<Hit[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const view = { layers, soloLayerId };
    const pos = new Map(layerOrder(layers).map((l, i) => [l.id, i]));
    const out: Hit[] = Object.values(nodes)
      .filter((n) => isNodeVisible(view, n) && (n.content.text ?? '').toLowerCase().includes(q))
      .sort((a, b) => (pos.get(a.layerId) ?? 0) - (pos.get(b.layerId) ?? 0) || a.zIndex - b.zIndex)
      .map((n) => ({ kind: 'node' as const, id: n.id, text: n.content.text ?? '' }));
    for (const e of Object.values(edges)) {
      if (e.label && isEdgeVisible(view, e, nodes) && e.label.toLowerCase().includes(q)) out.push({ kind: 'edge', id: e.id, text: e.label });
    }
    return out;
  }, [query, nodes, edges, layers, soloLayerId]);

  useEffect(() => setIndex(0), [query]);
  useEffect(() => setSearchHits(hits.filter((h) => h.kind === 'node').map((h) => h.id)), [hits, setSearchHits]);

  // Select and show the current hit whenever it changes.
  const current = hits.length ? hits[Math.min(index, hits.length - 1)] : null;
  useEffect(() => {
    if (!current) return;
    const store = useCanvas.getState();
    if (current.kind === 'node') {
      const n = store.nodes[current.id];
      if (!n) return;
      store.select([n.id]);
      ensureRectInView(n);
    } else {
      const e = store.edges[current.id];
      if (!e) return;
      store.select([e.id], { edges: true });
      const { from, to } = edgeEndpoints(e, store.nodes);
      const at = e.labelPoint ?? { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
      ensureRectInView({ x: at.x - 60, y: at.y - 20, width: 120, height: 40 });
    }
  }, [current?.kind, current?.id]);

  const step = (d: number) => {
    if (!hits.length) return;
    setIndex((i) => (i + d + hits.length) % hits.length);
  };
  // The buttons hand focus back so ↩ / esc keep working after a click.
  const clickStep = (d: number) => {
    step(d);
    inputRef.current?.focus();
  };

  return (
    <div
      className="absolute left-3 top-3 z-20 flex items-center gap-1 bg-panel/95 backdrop-blur border border-border rounded-lg shadow-panel px-2 py-1.5 text-sm"
      data-testid="board-search"
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        // Esc anywhere on the bar closes it; nothing on the bar reaches the canvas shortcuts.
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
        e.stopPropagation();
      }}
    >
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'ArrowDown') {
            e.preventDefault();
            step(e.key === 'Enter' && e.shiftKey ? -1 : 1);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            step(-1);
          }
        }}
        placeholder="Find text on this board…"
        className="w-56 bg-canvas rounded px-2 py-1 border border-border outline-none focus:border-accent"
      />
      <span className="text-xs text-fg-muted tabular-nums w-16 text-center" data-testid="board-search-count">
        {query.trim() ? (hits.length ? `${Math.min(index, hits.length - 1) + 1} of ${hits.length}` : 'none') : ''}
      </span>
      <button onClick={() => clickStep(-1)} disabled={!hits.length} className="p-1 rounded hover:bg-panel-hover text-fg-muted disabled:opacity-30" title="Previous (⇧↩)">
        <ChevronUp size={14} />
      </button>
      <button onClick={() => clickStep(1)} disabled={!hits.length} className="p-1 rounded hover:bg-panel-hover text-fg-muted disabled:opacity-30" title="Next (↩)">
        <ChevronDown size={14} />
      </button>
      <button onClick={onClose} className="p-1 rounded hover:bg-panel-hover text-fg-muted" title="Close (esc)">
        <X size={14} />
      </button>
    </div>
  );
}
