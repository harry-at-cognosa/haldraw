import { useState } from 'react';
import { Eye, EyeOff, Lock, Unlock, Plus, Trash2, ChevronUp, ChevronDown, Focus } from 'lucide-react';
import { layerOrder, useCanvas } from '@/store/canvasStore';

/** Layers list for the Board panel. Top of the stack first. */
export default function LayersPanel() {
  const layers = useCanvas((s) => s.layers);
  const nodes = useCanvas((s) => s.nodes);
  const edges = useCanvas((s) => s.edges);
  const currentLayerId = useCanvas((s) => s.currentLayerId);
  const soloLayerId = useCanvas((s) => s.soloLayerId);
  const addLayer = useCanvas((s) => s.addLayer);
  const renameLayer = useCanvas((s) => s.renameLayer);
  const setLayerVisible = useCanvas((s) => s.setLayerVisible);
  const setLayerLocked = useCanvas((s) => s.setLayerLocked);
  const moveLayer = useCanvas((s) => s.moveLayer);
  const deleteLayer = useCanvas((s) => s.deleteLayer);
  const setCurrentLayer = useCanvas((s) => s.setCurrentLayer);
  const setSoloLayer = useCanvas((s) => s.setSoloLayer);
  const select = useCanvas((s) => s.select);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const ordered = layerOrder(layers);
  const topFirst = [...ordered].reverse();
  const counts = new Map<string, number>();
  for (const n of Object.values(nodes)) counts.set(n.layerId, (counts.get(n.layerId) ?? 0) + 1);
  const edgeCounts = new Map<string, number>();
  for (const e of Object.values(edges)) edgeCounts.set(e.layerId, (edgeCounts.get(e.layerId) ?? 0) + 1);
  const describe = (shapes: number, lines: number) => {
    const parts: string[] = [];
    if (shapes || !lines) parts.push(`${shapes} shape${shapes === 1 ? '' : 's'}`);
    if (lines) parts.push(`${lines} line${lines === 1 ? '' : 's'}`);
    return parts.join(' · ');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-fg font-semibold">Layers</div>
        <button
          onClick={() => addLayer()}
          className="p-1 rounded hover:bg-panel-hover text-fg-muted hover:text-fg"
          title="New layer above the top (⌘⇧L)"
        >
          <Plus size={14} />
        </button>
      </div>
      <div className="rounded-md border border-border divide-y divide-border">
        {topFirst.map((l, idx) => {
          const isCurrent = l.id === currentLayerId;
          const isSolo = l.id === soloLayerId;
          const count = counts.get(l.id) ?? 0;
          const lineCount = edgeCounts.get(l.id) ?? 0;
          const total = count + lineCount;
          const isTop = idx === 0;
          const isBottom = idx === topFirst.length - 1;
          return (
            <div
              key={l.id}
              onClick={() => setCurrentLayer(l.id)}
              className={`group px-2 py-1.5 cursor-pointer ${
                isCurrent ? 'bg-accent-soft' : 'hover:bg-panel-hover'
              } ${!l.visible ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center gap-1.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setLayerVisible(l.id, !l.visible);
                  }}
                  className="p-0.5 rounded text-fg-muted hover:text-fg"
                  title={l.visible ? 'Hide layer' : 'Show layer'}
                >
                  {l.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setLayerLocked(l.id, !l.locked);
                  }}
                  className={`p-0.5 rounded hover:text-fg ${l.locked ? 'text-fg' : 'text-fg-muted'}`}
                  title={l.locked ? 'Unlock layer' : 'Lock layer (shapes on it ignore the pointer)'}
                >
                  {l.locked ? <Lock size={13} /> : <Unlock size={13} />}
                </button>
                {editingId === l.id ? (
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={() => {
                      renameLayer(l.id, draft);
                      setEditingId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        renameLayer(l.id, draft);
                        setEditingId(null);
                      } else if (e.key === 'Escape') {
                        setEditingId(null);
                      }
                      e.stopPropagation();
                    }}
                    className="flex-1 min-w-0 bg-canvas rounded px-1 py-0.5 border border-border outline-none focus:border-accent text-xs"
                  />
                ) : (
                  <span
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setDraft(l.name);
                      setEditingId(l.id);
                    }}
                    className={`flex-1 min-w-0 truncate text-xs ${isCurrent ? 'text-fg font-medium' : 'text-fg'}`}
                    title="Double-click to rename"
                  >
                    {l.name}
                  </span>
                )}
                <span className="text-[10px] text-fg-muted tabular-nums whitespace-nowrap" title="Shapes · lines on this layer">
                  {lineCount ? `${count} · ${lineCount}` : count}
                </span>
              </div>
              <div className="flex items-center gap-0.5 mt-1 pl-1 opacity-0 group-hover:opacity-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSoloLayer(isSolo ? null : l.id);
                  }}
                  className={`p-0.5 rounded text-[10px] px-1 ${
                    isSolo ? 'bg-accent text-white' : 'text-fg-muted hover:text-fg hover:bg-panel-hover'
                  }`}
                  title={isSolo ? 'Show all layers' : 'Solo: show only this layer (view only, not saved)'}
                >
                  <Focus size={12} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    moveLayer(l.id, 'up');
                  }}
                  disabled={isTop}
                  className="p-0.5 rounded text-fg-muted hover:text-fg hover:bg-panel-hover disabled:opacity-30"
                  title="Move layer up"
                >
                  <ChevronUp size={12} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    moveLayer(l.id, 'down');
                  }}
                  disabled={isBottom}
                  className="p-0.5 rounded text-fg-muted hover:text-fg hover:bg-panel-hover disabled:opacity-30"
                  title="Move layer down"
                >
                  <ChevronDown size={12} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (l.locked) return;
                    const ids = Object.values(nodes)
                      .filter((n) => n.layerId === l.id && !n.locked)
                      .map((n) => n.id);
                    const eids = Object.values(edges)
                      .filter((e) => e.layerId === l.id)
                      .map((e) => e.id);
                    if (ids.length) select(ids);
                    if (eids.length) select(eids, { edges: true, additive: ids.length > 0 });
                  }}
                  className="p-0.5 rounded text-[10px] px-1 text-fg-muted hover:text-fg hover:bg-panel-hover"
                  title="Select every unlocked shape and line on this layer"
                >
                  select
                </button>
                <span className="flex-1" />
                {ordered.length > 1 ? (
                  confirmId === l.id ? (
                    <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {total > 0 ? (
                        <button
                          onClick={() => {
                            deleteLayer(l.id, 'merge');
                            setConfirmId(null);
                          }}
                          className="px-1 rounded text-[10px] border border-border text-fg-muted hover:text-fg"
                          title="Move its shapes and lines to the layer below, then delete"
                        >
                          merge
                        </button>
                      ) : null}
                      <button
                        onClick={() => {
                          deleteLayer(l.id, 'delete');
                          setConfirmId(null);
                        }}
                        className="px-1 rounded text-[10px] bg-red-500 text-white"
                        title={total > 0 ? `Delete the layer and its ${describe(count, lineCount)}` : 'Delete the empty layer'}
                      >
                        delete
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="px-1 rounded text-[10px] text-fg-muted hover:text-fg"
                      >
                        cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmId(l.id);
                      }}
                      className="p-0.5 rounded text-fg-muted hover:text-red-400 hover:bg-panel-hover"
                      title="Delete layer…"
                    >
                      <Trash2 size={12} />
                    </button>
                  )
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-xs text-fg-muted leading-relaxed">
        New shapes and lines go on the highlighted layer. Clicking one switches to its layer.
        Hidden layers are left out of exports; Solo is a view aid and is not saved.
      </div>
    </div>
  );
}
