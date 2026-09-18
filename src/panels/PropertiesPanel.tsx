import { layerOrder, useCanvas } from '@/store/canvasStore';
import LayersPanel from './LayersPanel';
import {
  CONVERTIBLE_NODE_TYPES,
  EDGE_HEADS,
  type Anchor,
  type CanvasEdge,
  type CanvasNode,
  type ConvertibleNodeType,
  type EdgeHead,
  type EdgeRouting,
  type Layer,
  type NodeStyle,
} from '@shared/types';
import { HEAD_LABELS, HeadGlyph } from '@/canvas/edgeHeads';
import { notify, vectorizeNode } from '@/util/vectorize';
import { defaultStyleForBackground, EDGE_LABEL_FONT_DEFAULT } from '@/util/geometry';
import { useEffect, useRef, useState } from 'react';
import { listLocalFonts } from '@/util/fonts';
import { replaceSwatch } from '@/util/palette';
import { BACKGROUND_NAMES } from '@shared/types';
import {
  Minus,
  Spline,
  CornerDownRight,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
  Trash2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  Lock,
  Unlock,
  Sparkles,
  Square,
  Circle,
  Diamond,
  Cuboid,
  Database,
  PanelTop,
  Type,
} from 'lucide-react';

/** Buttons of the Shape section, in toolbar order. */
const SHAPE_KINDS: Array<{ type: ConvertibleNodeType; icon: React.ComponentType<any>; label: string }> = [
  { type: 'rect', icon: Square, label: 'Rectangle' },
  { type: 'ellipse', icon: Circle, label: 'Ellipse' },
  { type: 'diamond', icon: Diamond, label: 'Diamond' },
  { type: 'box3d', icon: Cuboid, label: '3D box' },
  { type: 'dsbox', icon: Database, label: 'Data store' },
  { type: 'colbox', icon: PanelTop, label: 'Collection' },
  { type: 'text', icon: Type, label: 'Text (no box)' },
];


export default function PropertiesPanel() {
  const selection = useCanvas((s) => s.selection);
  const edgeSelection = useCanvas((s) => s.edgeSelection);
  const nodes = useCanvas((s) => s.nodes);
  const edges = useCanvas((s) => s.edges);
  const updateNodes = useCanvas((s) => s.updateNodes);
  const updateEdges = useCanvas((s) => s.updateEdges);
  const checkpoint = useCanvas((s) => s.checkpoint);
  const bringToFront = useCanvas((s) => s.bringToFront);
  const sendToBack = useCanvas((s) => s.sendToBack);
  const bringForward = useCanvas((s) => s.bringForward);
  const sendBackward = useCanvas((s) => s.sendBackward);
  const deleteNodes = useCanvas((s) => s.deleteNodes);
  const deleteEdges = useCanvas((s) => s.deleteEdges);
  const alignSelection = useCanvas((s) => s.alignSelection);
  const distributeSelection = useCanvas((s) => s.distributeSelection);
  const rememberNodeStyle = useCanvas((s) => s.rememberNodeStyle);
  const rememberEdgeAttrs = useCanvas((s) => s.rememberEdgeAttrs);
  const resetNodeStyle = useCanvas((s) => s.resetNodeStyle);
  const setLocked = useCanvas((s) => s.setLocked);
  const changeNodeType = useCanvas((s) => s.changeNodeType);
  const PALETTE = useCanvas((s) => s.palette.swatches);
  const FILL_PALETTE = ['transparent', ...PALETTE];
  const layers = useCanvas((s) => s.layers);
  const moveToLayer = useCanvas((s) => s.moveToLayer);
  const boardBg = useCanvas((s) => s.board?.background ?? '#ffffff');

  const selectedNodes = [...selection].map((id) => nodes[id]).filter(Boolean) as CanvasNode[];
  const selectedEdges = [...edgeSelection].map((id) => edges[id]).filter(Boolean) as CanvasEdge[];

  if (selectedNodes.length === 0 && selectedEdges.length === 0) {
    return <BoardPanel />;
  }

  // `record` = false for per-tick slider changes; the slider checkpoints once at gesture start.
  const patch = (p: Partial<NodeStyle>, record = true) => {
    if (record) checkpoint();
    updateNodes(
      selectedNodes.map((n) => n.id),
      (n) => {
        n.style = { ...n.style, ...p };
      }
    );
    for (const n of selectedNodes) {
      rememberNodeStyle(n.type, { ...n.style, ...p });
    }
  };

  const patchEdges = (p: Partial<CanvasEdge>, record = true) => {
    if (record) checkpoint();
    // Merge style fields into the existing style; assigning `p` wholesale would
    // replace the style object and drop every field not in the patch.
    const { style, ...rest } = p;
    updateEdges(
      selectedEdges.map((e) => e.id),
      (edge) => {
        Object.assign(edge, rest);
        if (style) edge.style = { ...edge.style, ...style };
      }
    );
    rememberEdgeAttrs({
      style: p.style,
      routing: p.routing,
      headStart: p.headStart,
      headEnd: p.headEnd,
    });
  };

  const first = selectedNodes[0];
  const firstEdge = selectedEdges[0];
  const convertible = selectedNodes.length > 0 && selectedNodes.every((n) => (CONVERTIBLE_NODE_TYPES as readonly string[]).includes(n.type));
  const sameType = selectedNodes.every((n) => n.type === first?.type) ? first?.type : null;

  return (
    <aside className="w-64 shrink-0 border-l border-border bg-panel flex flex-col text-sm">
      <SelectionReadout nodes={selectedNodes} edges={selectedEdges} allNodes={nodes} layers={layers} />
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-4">
        {selectedNodes.length > 0 ? (
          <>
            {convertible ? (
              <Section title="Shape">
                <div className="grid grid-cols-7 gap-1" data-testid="shape-kind-row">
                  {SHAPE_KINDS.map((k) => (
                    <button
                      key={k.type}
                      onClick={() => changeNodeType(selectedNodes.map((n) => n.id), k.type)}
                      title={sameType === k.type ? k.label : `Change to ${k.label.toLowerCase()} (keeps size, style and text)`}
                      data-shape-kind={k.type}
                      className={`py-1.5 rounded flex items-center justify-center ${
                        sameType === k.type ? 'bg-accent text-white' : 'border border-border hover:bg-panel-hover text-fg-muted'
                      }`}
                    >
                      <k.icon size={14} />
                    </button>
                  ))}
                </div>
              </Section>
            ) : null}
            <Section title="Fill">
              <ColorRow
                options={FILL_PALETTE}
                value={first?.style.fill ?? '#1f2937'}
                onChange={(c) => patch({ fill: c })}
              />
            </Section>
            <Section title="Stroke">
              <ColorRow
                options={PALETTE}
                value={first?.style.stroke ?? '#e6e8eb'}
                onChange={(c) => patch({ stroke: c })}
              />
              <NumericSliderRow
                label="Width"
                sliderMin={0}
                sliderMax={12}
                step={0.5}
                min={0}
                max={100}
                value={first?.style.strokeWidth ?? 2}
                onBegin={checkpoint}
                onChange={(v) => patch({ strokeWidth: v }, false)}
              />
              <Row label="Style">
                <Segmented
                  options={[
                    { value: undefined, label: 'Solid' },
                    { value: '6 4', label: 'Dashed' },
                    { value: '2 3', label: 'Dotted' },
                  ]}
                  value={first?.style.strokeDasharray}
                  onChange={(v) => patch({ strokeDasharray: v })}
                />
              </Row>
            </Section>
            <Section title="Text">
              <ColorRow
                options={PALETTE}
                value={first?.style.color ?? '#e6e8eb'}
                onChange={(c) => patch({ color: c })}
              />
              <FontRow
                value={first?.style.fontFamily ?? ''}
                onChange={(family) => patch({ fontFamily: family || undefined })}
              />
              <SizeRow
                value={first?.style.fontSize ?? 16}
                onBegin={checkpoint}
                onChange={(v) => patch({ fontSize: v }, false)}
              />
              <Row label="Weight">
                <Segmented
                  options={[
                    { value: 400, label: 'Reg' },
                    { value: 500, label: 'Med' },
                    { value: 700, label: 'Bold' },
                  ]}
                  value={first?.style.fontWeight ?? 500}
                  onChange={(v) => patch({ fontWeight: v })}
                />
              </Row>
              <Row label="Align">
                <Segmented<'left' | 'center' | 'right'>
                  options={[
                    { value: 'left', label: 'L' },
                    { value: 'center', label: 'C' },
                    { value: 'right', label: 'R' },
                  ]}
                  value={first?.style.textAlign ?? 'center'}
                  onChange={(v) => patch({ textAlign: v })}
                />
              </Row>
              <Row label="V-Align">
                <Segmented<'top' | 'middle' | 'bottom'>
                  options={[
                    { value: 'top', label: 'T' },
                    { value: 'middle', label: 'M' },
                    { value: 'bottom', label: 'B' },
                  ]}
                  value={first?.style.verticalAlign ?? 'middle'}
                  onChange={(v) => patch({ verticalAlign: v })}
                />
              </Row>
            </Section>
            <Section title="Layer">
              <div className="grid grid-cols-4 gap-1">
                <IconBtn
                  icon={ChevronsUp}
                  label="Front (⌘⇧])"
                  onClick={() => bringToFront(selectedNodes.map((n) => n.id))}
                />
                <IconBtn
                  icon={ChevronUp}
                  label="Forward (⌘])"
                  onClick={() => bringForward(selectedNodes.map((n) => n.id))}
                />
                <IconBtn
                  icon={ChevronDown}
                  label="Backward (⌘[)"
                  onClick={() => sendBackward(selectedNodes.map((n) => n.id))}
                />
                <IconBtn
                  icon={ChevronsDown}
                  label="Back (⌘⇧[)"
                  onClick={() => sendToBack(selectedNodes.map((n) => n.id))}
                />
              </div>
              {Object.keys(layers).length > 1 ? (
                <Row label="On layer">
                  <select
                    value={selectedNodes.every((n) => n.layerId === first?.layerId) ? first?.layerId ?? '' : ''}
                    onChange={(e) => {
                      if (e.target.value) moveToLayer({ nodeIds: selectedNodes.map((n) => n.id) }, e.target.value);
                    }}
                    className="flex-1 min-w-0 bg-canvas rounded px-2 py-1 border border-border outline-none focus:border-accent text-xs"
                    title="Move the selection to another layer (⌘⌥] / ⌘⌥[ step up / down)"
                  >
                    {!selectedNodes.every((n) => n.layerId === first?.layerId) ? (
                      <option value="">Mixed…</option>
                    ) : null}
                    {[...layerOrder(layers)].reverse().map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </Row>
              ) : null}
            </Section>
            {selectedNodes.some((n) => n.type === 'rect') ? (
              <Section title="Corners">
                <SliderRow
                  label="Radius"
                  min={0}
                  max={48}
                  step={1}
                  value={first?.style.cornerRadius ?? 8}
                  onBegin={checkpoint}
                  onChange={(v) => patch({ cornerRadius: v }, false)}
                />
              </Section>
            ) : null}
            {selectedNodes.some((n) => n.type === 'colbox') ? (
              <Section title="Divider">
                <SliderRow
                  label="From top %"
                  min={10}
                  max={33}
                  step={1}
                  value={Math.round((first?.style.dividerFraction ?? 0.2) * 100)}
                  onBegin={checkpoint}
                  onChange={(v) => patch({ dividerFraction: v / 100 }, false)}
                />
              </Section>
            ) : null}
            <Section title="Rotation">
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={1}
                  value={Math.round(((first?.rotation ?? 0) * 180) / Math.PI) % 360}
                  onPointerDown={checkpoint}
                  onKeyDown={(e) => {
                    if (!e.repeat && SLIDER_KEYS.has(e.key)) checkpoint();
                  }}
                  onChange={(e) => {
                    const deg = Number(e.target.value);
                    updateNodes(
                      selectedNodes.map((n) => n.id),
                      (n) => {
                        n.rotation = (deg * Math.PI) / 180;
                      }
                    );
                  }}
                  className="flex-1 accent-sky-400"
                />
                <input
                  type="number"
                  min={0}
                  max={360}
                  value={Math.round(((first?.rotation ?? 0) * 180) / Math.PI) % 360}
                  onFocus={checkpoint}
                  onChange={(e) => {
                    const deg = Number(e.target.value);
                    updateNodes(
                      selectedNodes.map((n) => n.id),
                      (n) => {
                        n.rotation = (deg * Math.PI) / 180;
                      }
                    );
                  }}
                  className="w-16 text-right bg-canvas rounded px-2 py-1 border border-border outline-none focus:border-accent"
                />
              </div>
            </Section>
            {selectedNodes.length >= 2 ? (
              <Section title="Align">
                <div className="grid grid-cols-6 gap-1">
                  <IconBtn icon={AlignLeft} label="Align left" onClick={() => alignSelection('left')} />
                  <IconBtn icon={AlignCenter} label="Align horizontal center" onClick={() => alignSelection('center-h')} />
                  <IconBtn icon={AlignRight} label="Align right" onClick={() => alignSelection('right')} />
                  <IconBtn icon={AlignStartVertical} label="Align top" onClick={() => alignSelection('top')} />
                  <IconBtn icon={AlignCenterVertical} label="Align vertical middle" onClick={() => alignSelection('middle')} />
                  <IconBtn icon={AlignEndVertical} label="Align bottom" onClick={() => alignSelection('bottom')} />
                </div>
                {selectedNodes.length >= 3 ? (
                  <div className="grid grid-cols-2 gap-1 pt-1">
                    <IconBtn
                      icon={AlignHorizontalDistributeCenter}
                      label="Distribute horizontally (3+)"
                      onClick={() => distributeSelection('h')}
                    />
                    <IconBtn
                      icon={AlignVerticalDistributeCenter}
                      label="Distribute vertically (3+)"
                      onClick={() => distributeSelection('v')}
                    />
                  </div>
                ) : null}
              </Section>
            ) : null}
            {selectedNodes.some((n) => n.type === 'image') ? (
              <Section title="Image">
                <SliderRow
                  label="Opacity"
                  min={5}
                  max={100}
                  step={5}
                  value={Math.round((first?.style.opacity ?? 1) * 100)}
                  onBegin={checkpoint}
                  onChange={(v) => patch({ opacity: v / 100 }, false)}
                />
                {selectedNodes.length === 1 && first?.type === 'image' ? <VectorizeButton node={first} /> : null}
                <button
                  onClick={() => setLocked(selectedNodes.map((n) => n.id), true)}
                  className="w-full rounded-md border border-border px-3 py-2 text-fg-muted hover:text-fg hover:border-fg-muted text-sm inline-flex items-center justify-center gap-1.5"
                  title="Reference layer: stays visible and exports, but no longer responds to clicks or drags. Unlock from the Board panel."
                >
                  <Lock size={14} /> Lock as reference
                </button>
                {selectedNodes.length === 1 &&
                first?.content.naturalWidth &&
                first?.content.naturalHeight ? (
                  <button
                    onClick={() => {
                      checkpoint();
                      updateNodes([first.id], (n) => {
                        n.width = n.content.naturalWidth!;
                        n.height = n.content.naturalHeight!;
                      });
                    }}
                    className="w-full rounded-md border border-border px-3 py-2 text-fg-muted hover:text-fg hover:border-fg-muted text-sm"
                    title="Restore the image's intrinsic pixel size, keeping the top-left corner in place"
                  >
                    Reset to original size ({first.content.naturalWidth} × {first.content.naturalHeight})
                  </button>
                ) : null}
                <div className="text-xs text-fg-muted pt-1 leading-relaxed">
                  Hold ⇧ while resizing to keep the aspect ratio.
                </div>
              </Section>
            ) : null}
            <Section title="Link">
              <input
                type="text"
                value={first?.content.link ?? ''}
                onFocus={checkpoint}
                onChange={(e) => {
                  const v = e.target.value;
                  updateNodes(
                    selectedNodes.map((n) => n.id),
                    (n) => {
                      n.content = { ...n.content, link: v || undefined };
                    }
                  );
                }}
                placeholder="https://… or haldraw://board/ID"
                className="w-full bg-canvas rounded px-2 py-1.5 border border-border outline-none focus:border-accent text-sm"
              />
              <div className="text-xs text-fg-muted pt-1 leading-relaxed">
                ⌘-click the shape (or its link badge) to open. Internal board
                links drill into another diagram without leaving haldraw.
              </div>
            </Section>
            <button
              onClick={() => resetNodeStyle(selectedNodes.map((n) => n.id))}
              className="w-full rounded-md border border-border px-3 py-2 text-fg-muted hover:text-fg hover:border-fg-muted text-sm"
              title="Restore the shape's default style and clear remembered style for this type"
            >
              Reset styles
            </button>
            <button
              onClick={() => deleteNodes(selectedNodes.map((n) => n.id))}
              className="w-full rounded-md border border-border px-3 py-2 text-fg-muted hover:text-red-400 hover:border-red-400 inline-flex items-center justify-center gap-1.5"
            >
              <Trash2 size={14} /> Delete
            </button>
          </>
        ) : null}

        {selectedEdges.length > 0 ? (
          <>
            {firstEdge?.fromNode || firstEdge?.toNode ? (
              <Section title="Anchors">
                {firstEdge?.fromNode ? (
                  <AnchorRow
                    label="From"
                    value={firstEdge?.fromAnchor ?? 'auto'}
                    onChange={(a) => patchEdges({ fromAnchor: a })}
                  />
                ) : null}
                {firstEdge?.toNode ? (
                  <AnchorRow
                    label="To"
                    value={firstEdge?.toAnchor ?? 'auto'}
                    onChange={(a) => patchEdges({ toAnchor: a })}
                  />
                ) : null}
              </Section>
            ) : null}
            <Section title="Routing">
              <div className="grid grid-cols-3 gap-1">
                <RouteBtn
                  active={firstEdge?.routing === 'straight'}
                  onClick={() => patchEdges({ routing: 'straight' as EdgeRouting })}
                  icon={Minus}
                  label="Straight"
                />
                <RouteBtn
                  active={firstEdge?.routing === 'orthogonal'}
                  onClick={() => patchEdges({ routing: 'orthogonal' as EdgeRouting })}
                  icon={CornerDownRight}
                  label="Right-angle"
                />
                <RouteBtn
                  active={firstEdge?.routing === 'curved'}
                  onClick={() => patchEdges({ routing: 'curved' as EdgeRouting })}
                  icon={Spline}
                  label="Curved"
                />
              </div>
            </Section>
            <Section title="Heads">
              <HeadRow
                label="Start"
                end="start"
                value={firstEdge?.headStart ?? 'none'}
                onChange={(h) => patchEdges({ headStart: h })}
              />
              <HeadRow
                label="End"
                end="end"
                value={firstEdge?.headEnd ?? 'none'}
                onChange={(h) => patchEdges({ headEnd: h })}
              />
            </Section>
            <Section title="Layer">
              <div className="grid grid-cols-4 gap-1 opacity-40" title="Lines draw beneath the shapes on their layer; stacking within a layer is not yet available">
                <IconBtn icon={ChevronsUp} label="Front" onClick={() => {}} disabled />
                <IconBtn icon={ChevronUp} label="Forward" onClick={() => {}} disabled />
                <IconBtn icon={ChevronDown} label="Backward" onClick={() => {}} disabled />
                <IconBtn icon={ChevronsDown} label="Back" onClick={() => {}} disabled />
              </div>
              {Object.keys(layers).length > 1 ? (
                <Row label="On layer">
                  <select
                    value={selectedEdges.every((e) => e.layerId === firstEdge?.layerId) ? firstEdge?.layerId ?? '' : ''}
                    onChange={(e) => {
                      if (e.target.value) moveToLayer({ edgeIds: selectedEdges.map((ed) => ed.id) }, e.target.value);
                    }}
                    className="flex-1 min-w-0 bg-canvas rounded px-2 py-1 border border-border outline-none focus:border-accent text-xs"
                    title="Move the line to another layer (⌘⌥] / ⌘⌥[ step up / down)"
                  >
                    {!selectedEdges.every((e) => e.layerId === firstEdge?.layerId) ? (
                      <option value="">Mixed…</option>
                    ) : null}
                    {[...layerOrder(layers)].reverse().map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </Row>
              ) : null}
            </Section>
            <Section title="Color">
              <ColorRow
                options={PALETTE}
                value={firstEdge?.style.stroke ?? '#e6e8eb'}
                onChange={(c) => patchEdges({ style: { stroke: c } })}
              />
            </Section>
            <Section title="Stroke">
              <NumericSliderRow
                label="Width"
                sliderMin={0.5}
                sliderMax={12}
                step={0.5}
                min={0.5}
                max={100}
                value={firstEdge?.style.strokeWidth ?? 2}
                onBegin={checkpoint}
                onChange={(v) => patchEdges({ style: { strokeWidth: v } }, false)}
              />
              <Row label="Style">
                <Segmented
                  options={[
                    { value: undefined, label: 'Solid' },
                    { value: '6 4', label: 'Dashed' },
                    { value: '2 3', label: 'Dotted' },
                  ]}
                  value={firstEdge?.style.strokeDasharray}
                  onChange={(v) => patchEdges({ style: { strokeDasharray: v } })}
                />
              </Row>
            </Section>
            <Section title="Label">
              <input
                type="text"
                value={firstEdge?.label ?? ''}
                onFocus={checkpoint}
                onChange={(e) => {
                  updateEdges(
                    selectedEdges.map((ed) => ed.id),
                    (edge) => {
                      edge.label = e.target.value;
                    }
                  );
                }}
                placeholder="optional"
                className="w-full bg-canvas rounded px-2 py-1 border border-border outline-none focus:border-accent"
              />
              <div className="pt-2">
                <ColorRow
                  options={PALETTE}
                  value={firstEdge?.style.color ?? defaultStyleForBackground(boardBg).color ?? '#0b0d10'}
                  onChange={(c) => patchEdges({ style: { color: c } })}
                />
              </div>
              <FontRow
                value={firstEdge?.style.fontFamily ?? ''}
                onChange={(family) => patchEdges({ style: { fontFamily: family || undefined } })}
              />
              <SliderRow
                label="Size"
                min={8}
                max={48}
                step={1}
                value={firstEdge?.style.fontSize ?? EDGE_LABEL_FONT_DEFAULT}
                onBegin={checkpoint}
                onChange={(v) => patchEdges({ style: { fontSize: v } }, false)}
              />
              <Row label="Weight">
                <Segmented
                  options={[
                    { value: 400, label: 'Reg' },
                    { value: 500, label: 'Med' },
                    { value: 700, label: 'Bold' },
                  ]}
                  value={firstEdge?.style.fontWeight ?? 400}
                  onChange={(v) => patchEdges({ style: { fontWeight: v } })}
                />
              </Row>
            </Section>
            <button
              onClick={() => deleteEdges(selectedEdges.map((e) => e.id))}
              className="w-full rounded-md border border-border px-3 py-2 text-fg-muted hover:text-red-400 hover:border-red-400 inline-flex items-center justify-center gap-1.5"
            >
              <Trash2 size={14} /> Delete
            </button>
          </>
        ) : null}
      </div>
    </aside>
  );
}

/**
 * Vectorize… for one image node. Full-width in the Image section; a small icon
 * in the Reference images list, where locked images live.
 */
function VectorizeButton({ node, compact }: { node: CanvasNode; compact?: boolean }) {
  const progress = useCanvas((s) => s.vectorizeProgress[node.id] ?? null);
  const busyElsewhere = useCanvas((s) => !s.vectorizeProgress[node.id] && Object.keys(s.vectorizeProgress).length > 0);
  const run = async () => {
    try {
      const r = await vectorizeNode(node);
      notify(
        'ok',
        `Draft: ${r.shapes} shape${r.shapes === 1 ? '' : 's'}, ${r.connectors} connector${r.connectors === 1 ? '' : 's'}` +
          (r.lowConfidence ? `, ${r.lowConfidence} dashed (low confidence)` : '') +
          ` · ${r.model} · ${r.inputTokens + r.outputTokens} tokens`
      );
    } catch (err) {
      notify('err', (err as Error).message);
    }
  };
  const title = busyElsewhere
    ? 'Vectorize is busy with another image'
    : 'Vectorize: ask the vision model for an editable draft of this image, placed on a Draft layer above it (Settings… sets the model and key)';
  const disabled = progress !== null || busyElsewhere;
  if (compact) {
    return (
      <>
        <button
          onClick={run}
          disabled={disabled}
          title={progress ?? title}
          className="p-1 rounded hover:bg-panel-hover text-fg-muted hover:text-fg disabled:opacity-60"
        >
          <Sparkles size={12} className={progress ? 'animate-pulse' : ''} />
        </button>
        {progress ? (
          <span className="absolute left-2 -bottom-4 text-[10px] text-accent whitespace-nowrap animate-pulse">{progress}</span>
        ) : null}
      </>
    );
  }
  return (
    <button
      onClick={run}
      disabled={disabled}
      title={title}
      className="w-full rounded-md border border-accent px-3 py-2 text-fg hover:bg-accent-soft text-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
    >
      <Sparkles size={14} className={progress ? 'animate-pulse' : ''} /> {progress ?? 'Vectorize…'}
    </button>
  );
}

const TYPE_LABEL: Record<CanvasNode['type'], string> = {
  rect: 'Rectangle',
  ellipse: 'Ellipse',
  diamond: 'Diamond',
  box3d: '3D box',
  dsbox: 'Data store',
  colbox: 'Collection',
  text: 'Text',
  icon: 'Icon',
  image: 'Image',
};

function snippet(text: string | undefined, max = 28): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return 'empty';
  return `“${t.length > max ? t.slice(0, max - 1) + '…' : t}”`;
}

const r0 = (v: number) => String(Math.round(v));

/**
 * Two-line description of the selection: what it is (type and content), then
 * where it is (layer, z-rank within that layer, size and position). Exists so an
 * accidental sliver or an empty text box can be identified from the panel alone.
 */
function SelectionReadout({
  nodes: sel,
  edges: selEdges,
  allNodes,
  layers,
}: {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  allNodes: Record<string, CanvasNode>;
  layers: Record<string, Layer>;
}) {
  const layerName = (id: string) => layers[id]?.name ?? '—';
  const zRank = (n: CanvasNode) => {
    const stack = Object.values(allNodes)
      .filter((o) => o.layerId === n.layerId)
      .sort((a, b) => a.zIndex - b.zIndex);
    return `z ${stack.findIndex((o) => o.id === n.id) + 1}/${stack.length}`;
  };
  let what: string;
  let where: string;
  if (selEdges.length > 0 && sel.length === 0) {
    if (selEdges.length > 1) {
      what = `${selEdges.length} lines`;
      const ls = new Set(selEdges.map((e) => e.layerId));
      where = ls.size === 1 ? layerName(selEdges[0].layerId) : 'mixed layers';
    } else {
      const e = selEdges[0];
      const a = e.fromNode ? allNodes[e.fromNode] : null;
      const b = e.toNode ? allNodes[e.toNode] : null;
      const name = (n: CanvasNode | null) => (n ? (n.content.text?.trim() ? snippet(n.content.text, 14) : TYPE_LABEL[n.type]) : '•');
      what = a || b ? `Connector · ${name(a)} → ${name(b)}` : 'Line';
      where = `${layerName(e.layerId)} · ${e.routing}${e.label ? ` · ${snippet(e.label, 16)}` : ''}`;
    }
  } else if (sel.length === 1) {
    const n = sel[0];
    const content =
      n.type === 'image'
        ? n.content.naturalWidth
          ? `${n.content.naturalWidth} × ${n.content.naturalHeight} px${n.locked ? ' · locked' : ''}`
          : n.locked ? 'locked' : ''
        : n.type === 'icon'
          ? n.content.iconName ?? ''
          : snippet(n.content.text);
    what = `${TYPE_LABEL[n.type]}${content ? ` · ${content}` : ''}`;
    where = `${layerName(n.layerId)} · ${zRank(n)} · ${r0(n.width)} × ${r0(n.height)} at ${r0(n.x)}, ${r0(n.y)}`;
  } else {
    const counts = new Map<string, number>();
    for (const n of sel) counts.set(TYPE_LABEL[n.type], (counts.get(TYPE_LABEL[n.type]) ?? 0) + 1);
    what = [...counts].map(([t, c]) => `${c} ${t.toLowerCase()}${c > 1 ? 's' : ''}`).join(', ');
    if (selEdges.length) what += `, ${selEdges.length} line${selEdges.length > 1 ? 's' : ''}`;
    const ls = new Set(sel.map((n) => n.layerId));
    const minX = Math.min(...sel.map((n) => n.x));
    const minY = Math.min(...sel.map((n) => n.y));
    const maxX = Math.max(...sel.map((n) => n.x + n.width));
    const maxY = Math.max(...sel.map((n) => n.y + n.height));
    where = `${ls.size === 1 ? layerName(sel[0].layerId) : 'mixed layers'} · ${r0(maxX - minX)} × ${r0(maxY - minY)} at ${r0(minX)}, ${r0(minY)}`;
  }
  return (
    <div className="p-3 border-b border-border" title={`${what}\n${where}`}>
      <div className="text-sm text-fg font-semibold truncate">{what}</div>
      <div className="text-xs text-fg-muted truncate tabular-nums">{where}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wider text-fg font-semibold">{title}</div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-fg-muted text-xs">{label}</span>
      {children}
    </div>
  );
}

/**
 * Swatch row. Click applies a colour; right-click or ⌥-click opens the native
 * colour panel and replaces that swatch in the app-wide palette (live while the
 * panel is open, saved a moment after the last change). The rainbow swatch is a one-off custom
 * colour and touches no swatch; transparent cannot be replaced.
 */
function ColorRow({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (c: string) => void;
}) {
  const isHex = /^#[0-9a-f]{6}$/i.test(value);
  const custom = isHex && !options.includes(value.toLowerCase()) && !options.includes(value);
  const editRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const openReplace = (i: number, current: string) => {
    if (current === 'transparent' || !editRef.current) {
      setEditing(null);
      return;
    }
    setEditing(i);
    editRef.current.value = /^#[0-9a-f]{6}$/i.test(current) ? current : '#ffffff';
    // Defer so the value is set before the panel reads it.
    setTimeout(() => editRef.current?.click(), 0);
  };
  // Map a row index to its palette index: the fill row prepends transparent.
  const paletteIndex = (i: number) => (options[0] === 'transparent' ? i - 1 : i);
  return (
    <div className="flex gap-1 flex-wrap items-center">
      {options.map((c, i) => (
        <button
          key={`${i}-${c}`}
          onClick={(e) => {
            if (e.altKey) openReplace(i, c);
            else onChange(c);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            openReplace(i, c);
          }}
          data-swatch={c}
          className={`w-6 h-6 rounded ${value === c ? 'ring-2 ring-accent ring-offset-1 ring-offset-panel' : 'ring-1 ring-border'}`}
          style={{
            background:
              c === 'transparent' ? 'repeating-linear-gradient(45deg,#999 0 3px,#ddd 3px 6px)' : c,
          }}
          title={c === 'transparent' ? 'Transparent (no fill)' : `${c} — right-click or ⌥-click to replace this swatch`}
        />
      ))}
      <label
        className={`w-6 h-6 rounded overflow-hidden cursor-pointer relative ${
          custom ? 'ring-2 ring-accent ring-offset-1 ring-offset-panel' : 'ring-1 ring-border'
        }`}
        title={custom ? `Custom ${value}` : 'Custom colour… (one-off, not added to the palette)'}
        style={{
          background: custom
            ? value
            : 'conic-gradient(#ef4444,#f59e0b,#10b981,#38bdf8,#6366f1,#d946ef,#ef4444)',
        }}
      >
        <input
          type="color"
          value={isHex ? value : '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
        />
      </label>
      <input
        ref={editRef}
        type="color"
        data-testid="swatch-editor"
        className="absolute w-0 h-0 opacity-0 pointer-events-none"
        tabIndex={-1}
        onChange={(e) => {
          if (editing === null) return;
          replaceSwatch('swatches', paletteIndex(editing), e.target.value);
          onChange(e.target.value);
        }}
      />
    </div>
  );
}

/** Font family combobox: installed families via datalist, free text allowed, empty = default. */
function FontRow({ value, onChange }: { value: string; onChange: (family: string) => void }) {
  const [families, setFamilies] = useState<string[] | null>(null);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const load = () => {
    if (families) return;
    listLocalFonts().then(setFamilies);
  };
  const commit = () => {
    const v = draft.trim();
    if (v !== value) onChange(v);
  };
  return (
    <div className="flex items-center gap-2">
      <span className="text-fg-muted text-xs w-12">Font</span>
      <input
        type="text"
        list="haldraw-font-families"
        value={draft}
        placeholder="Default (Inter)"
        onFocus={load}
        onPointerDown={load}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
            (e.target as HTMLInputElement).blur();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setDraft(value);
            (e.target as HTMLInputElement).blur();
          }
          e.stopPropagation();
        }}
        style={{ fontFamily: draft || undefined }}
        className="flex-1 min-w-0 bg-canvas rounded px-2 py-1 border border-border outline-none focus:border-accent text-sm"
        title="Pick an installed font or type any family name. Clear the field for the default."
      />
      <datalist id="haldraw-font-families">
        {(families ?? []).map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
    </div>
  );
}

/** Slider for the common range plus a numeric field for anything within [min, max]. */
/** Keys that move a focused range input; the first press of one starts a gesture. */
const SLIDER_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End']);

function NumericSliderRow({
  label,
  sliderMin,
  sliderMax,
  step,
  min,
  max,
  value,
  onBegin,
  onChange,
}: {
  label: string;
  sliderMin: number;
  sliderMax: number;
  step: number;
  min: number;
  max: number;
  value: number;
  /** Called once at the start of a slider drag / key press and before a typed commit; the undo point. */
  onBegin?: () => void;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const decimals = step < 1 ? 1 : 0;
  const commit = () => {
    const n = Number(draft);
    if (!Number.isFinite(n)) {
      setDraft(String(value));
      return;
    }
    const rounded = Number(n.toFixed(decimals));
    const clamped = Math.min(max, Math.max(min, rounded));
    setDraft(String(clamped));
    if (clamped !== value) {
      onBegin?.();
      onChange(clamped);
    }
  };
  return (
    <div className="flex items-center gap-2">
      <span className="text-fg-muted text-xs w-12">{label}</span>
      <input
        type="range"
        min={sliderMin}
        max={sliderMax}
        step={step}
        value={Math.min(sliderMax, Math.max(sliderMin, value))}
        onPointerDown={onBegin}
        onKeyDown={(e) => {
          if (!e.repeat && SLIDER_KEYS.has(e.key)) onBegin?.();
        }}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-sky-400"
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
            (e.target as HTMLInputElement).blur();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setDraft(String(value));
            (e.target as HTMLInputElement).blur();
          }
          e.stopPropagation();
        }}
        className="w-14 bg-canvas rounded px-1.5 py-0.5 border border-border outline-none focus:border-accent text-xs tabular-nums text-right"
        title={`Type any value from ${min} to ${max}`}
      />
    </div>
  );
}

function SizeRow({ value, onBegin, onChange }: { value: number; onBegin?: () => void; onChange: (v: number) => void }) {
  return (
    <NumericSliderRow
      label="Size"
      sliderMin={8}
      sliderMax={72}
      step={1}
      min={4}
      max={999}
      value={value}
      onBegin={onBegin}
      onChange={onChange}
    />
  );
}

function SliderRow({
  label,
  min,
  max,
  step,
  value,
  onBegin,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onBegin?: () => void;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-fg-muted text-xs w-12">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={onBegin}
        onKeyDown={(e) => {
          if (!e.repeat && SLIDER_KEYS.has(e.key)) onBegin?.();
        }}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-sky-400"
      />
      <span className="w-8 text-right text-xs tabular-nums text-fg-muted">{value}</span>
    </div>
  );
}

function Segmented<T>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded border border-border overflow-hidden">
      {options.map((o, i) => (
        <button
          key={i}
          onClick={() => onChange(o.value)}
          className={`px-2 py-1 text-xs ${
            value === o.value ? 'bg-accent text-white' : 'hover:bg-panel-hover text-fg-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Six head styles as small line previews; the marker sits at the row's own end. */
function HeadRow({
  label,
  end,
  value,
  onChange,
}: {
  label: string;
  end: 'start' | 'end';
  value: EdgeHead;
  onChange: (h: EdgeHead) => void;
}) {
  return (
    <Row label={label}>
      <div className="flex flex-1 rounded border border-border overflow-hidden">
        {EDGE_HEADS.map((h) => (
          <button
            key={h}
            onClick={() => onChange(h)}
            title={HEAD_LABELS[h]}
            className={`flex-1 py-1 flex items-center justify-center ${
              value === h ? 'bg-accent text-white' : 'hover:bg-panel-hover text-fg-muted'
            }`}
          >
            <HeadGlyph kind={h} end={end} />
          </button>
        ))}
      </div>
    </Row>
  );
}

function RouteBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<any>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`py-2 rounded flex flex-col items-center gap-1 text-xs ${
        active ? 'bg-accent text-white' : 'hover:bg-panel-hover text-fg-muted border border-border'
      }`}
    >
      <Icon size={16} />
      <span>{label}</span>
    </button>
  );
}

function IconBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ComponentType<any>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      disabled={disabled}
      className="py-1.5 rounded border border-border hover:bg-panel-hover flex items-center justify-center text-fg-muted disabled:hover:bg-transparent disabled:cursor-default"
    >
      <Icon size={14} />
    </button>
  );
}

function AnchorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Anchor;
  onChange: (a: Anchor) => void;
}) {
  const options: Array<{ v: Anchor; l: string }> = [
    { v: 'auto', l: 'Auto' },
    { v: 'top', l: 'Top' },
    { v: 'right', l: 'Right' },
    { v: 'bottom', l: 'Bot' },
    { v: 'left', l: 'Left' },
    { v: 'center', l: 'Ctr' },
  ];
  return (
    <div className="flex items-center gap-2">
      <span className="text-fg-muted text-xs w-10">{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={o.v}
            onClick={() => onChange(o.v)}
            className={`px-2 py-0.5 rounded text-xs ${
              value === o.v ? 'bg-accent text-white' : 'border border-border hover:bg-panel-hover text-fg-muted'
            }`}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}

function BoardPanel() {
  const board = useCanvas((s) => s.board);
  const setBoardBackground = useCanvas((s) => s.setBoardBackground);
  const setBoardDimReferences = useCanvas((s) => s.setBoardDimReferences);
  const refView = useCanvas((s) => s.refView);
  const setRefView = useCanvas((s) => s.setRefView);
  const nodes = useCanvas((s) => s.nodes);
  const setLocked = useCanvas((s) => s.setLocked);
  const select = useCanvas((s) => s.select);
  const deleteNodes = useCanvas((s) => s.deleteNodes);
  const lockedNodes = Object.values(nodes)
    .filter((n) => n.locked)
    .sort((a, b) => a.zIndex - b.zIndex);
  const writeTimer = useRef<number | null>(null);
  const backgrounds = useCanvas((s) => s.palette.backgrounds);
  const BOARD_BG_PALETTE: Array<{ value: string; label: string }> = [
    ...backgrounds.map((value) => ({ value, label: BACKGROUND_NAMES[value] ?? value })),
    { value: 'transparent', label: 'Transparent' },
  ];
  const bgEditRef = useRef<HTMLInputElement>(null);
  const [bgEditing, setBgEditing] = useState<number | null>(null);
  const openBgReplace = (i: number) => {
    if (i >= backgrounds.length || !bgEditRef.current) {
      setBgEditing(null);
      return;
    }
    setBgEditing(i);
    bgEditRef.current.value = backgrounds[i];
    setTimeout(() => bgEditRef.current?.click(), 0);
  };

  const set = (color: string) => {
    if (!board) return;
    setBoardBackground(color);
    if (writeTimer.current) window.clearTimeout(writeTimer.current);
    writeTimer.current = window.setTimeout(() => {
      window.haldraw.boards.setBackground(board.id, color);
    }, 200);
  };

  if (!board) return null;
  const current = board.background ?? '#ffffff';
  return (
    <aside className="w-64 shrink-0 border-l border-border bg-panel flex flex-col text-sm">
      <div className="p-3 border-b border-border text-sm text-fg font-semibold uppercase tracking-wide">
        Board
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-4">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-fg font-semibold">
            Background
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {BOARD_BG_PALETTE.map((o, i) => (
              <button
                key={`${i}-${o.value}`}
                onClick={(e) => {
                  if (e.altKey) openBgReplace(i);
                  else set(o.value);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  openBgReplace(i);
                }}
                data-swatch={o.value}
                title={o.value === 'transparent' ? o.label : `${o.label} — right-click or ⌥-click to replace this swatch`}
                className={`aspect-square rounded ring-1 ring-border hover:ring-accent ${
                  current === o.value ? 'ring-2 ring-accent' : ''
                }`}
                style={{
                  background:
                    o.value === 'transparent'
                      ? 'repeating-linear-gradient(45deg,#999 0 4px,#ddd 4px 8px)'
                      : o.value,
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <label className="text-sm text-fg">Custom</label>
            <input
              type="color"
              value={/^#[0-9a-f]{6}$/i.test(current) ? current : '#ffffff'}
              onChange={(e) => set(e.target.value)}
              className="w-8 h-7 rounded border border-border bg-canvas cursor-pointer"
            />
            <input
              ref={bgEditRef}
              type="color"
              data-testid="bg-swatch-editor"
              className="absolute w-0 h-0 opacity-0 pointer-events-none"
              tabIndex={-1}
              onChange={(e) => {
                if (bgEditing === null) return;
                replaceSwatch('backgrounds', bgEditing, e.target.value);
                set(e.target.value);
              }}
            />
          </div>
          <div className="text-xs text-fg-muted pt-2 leading-relaxed">
            This colour is the board's paper and is included in Solid exports.
            Transparent exports always ignore it. Right-click a swatch to replace it
            in the palette (Settings… resets the palette).
          </div>
        </div>
        <LayersPanel />
        {lockedNodes.length > 0 ? (
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wider text-fg font-semibold">
              Reference images
            </div>
            {lockedNodes.map((n) => (
              <div
                key={n.id}
                className="relative flex items-center gap-2 rounded-md border border-border px-2 py-1.5 mb-3"
              >
                <Lock size={12} className="text-fg-muted shrink-0" />
                <span className="flex-1 truncate text-xs text-fg" title={n.id}>
                  {n.type === 'image' ? 'Image' : n.type}{' '}
                  {Math.round(n.width)} × {Math.round(n.height)}
                </span>
                {n.type === 'image' ? <VectorizeButton node={n} compact /> : null}
                <button
                  onClick={() => {
                    setLocked([n.id], false);
                    select([n.id]);
                  }}
                  title="Unlock and select"
                  className="p-1 rounded hover:bg-panel-hover text-fg-muted hover:text-fg"
                >
                  <Unlock size={12} />
                </button>
                <button
                  onClick={() => deleteNodes([n.id])}
                  title="Remove"
                  className="p-1 rounded hover:bg-panel-hover text-fg-muted hover:text-red-400"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            <div className="grid grid-cols-3 gap-1 pt-1">
              {(
                [
                  ['normal', 'Normal'],
                  ['hidden', 'Hide refs'],
                  ['only', 'Refs only'],
                ] as Array<[typeof refView, string]>
              ).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setRefView(v)}
                  className={`py-1.5 rounded text-xs ${
                    refView === v ? 'bg-accent text-white' : 'border border-border text-fg-muted hover:bg-panel-hover'
                  }`}
                  title={
                    v === 'normal'
                      ? 'Show everything'
                      : v === 'hidden'
                        ? 'Hide locked reference images to check the drawing'
                        : 'Show only locked reference images to check the original'
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={board.dimReferences}
                onChange={(e) => {
                  setBoardDimReferences(e.target.checked);
                  window.haldraw.boards.setDimReferences(board.id, e.target.checked);
                }}
              />
              <span className="text-xs text-fg">Dim references on canvas</span>
            </label>
            <div className="text-xs text-fg-muted pt-1 leading-relaxed">
              Locked images ignore clicks and drags so you can draw over them. The view
              buttons and dimming are canvas aids only: exports always include everything,
              and the view resets to Normal when you reopen the board.
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
