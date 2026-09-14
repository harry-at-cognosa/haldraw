import { useCanvas } from '@/store/canvasStore';
import type { Anchor, CanvasEdge, CanvasNode, EdgeRouting, NodeStyle } from '@shared/types';
import { useEffect, useRef, useState } from 'react';
import { listLocalFonts } from '@/util/fonts';
import {
  ArrowBigLeft,
  ArrowBigRight,
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
} from 'lucide-react';

const PALETTE = [
  '#ffffff',
  '#000000',
  '#e6e8eb',
  '#0b0d10',
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#38bdf8',
  '#6366f1',
  '#d946ef',
];
const FILL_PALETTE = ['transparent', ...PALETTE];

export default function PropertiesPanel() {
  const selection = useCanvas((s) => s.selection);
  const edgeSelection = useCanvas((s) => s.edgeSelection);
  const nodes = useCanvas((s) => s.nodes);
  const edges = useCanvas((s) => s.edges);
  const updateNodes = useCanvas((s) => s.updateNodes);
  const updateEdges = useCanvas((s) => s.updateEdges);
  const commit = useCanvas((s) => s.commit);
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

  const selectedNodes = [...selection].map((id) => nodes[id]).filter(Boolean) as CanvasNode[];
  const selectedEdges = [...edgeSelection].map((id) => edges[id]).filter(Boolean) as CanvasEdge[];

  if (selectedNodes.length === 0 && selectedEdges.length === 0) {
    return <BoardPanel />;
  }

  const patch = (p: Partial<NodeStyle>) => {
    updateNodes(
      selectedNodes.map((n) => n.id),
      (n) => {
        n.style = { ...n.style, ...p };
      }
    );
    for (const n of selectedNodes) {
      rememberNodeStyle(n.type, { ...n.style, ...p });
    }
    commit();
  };

  const patchEdges = (p: Partial<CanvasEdge>) => {
    updateEdges(
      selectedEdges.map((e) => e.id),
      (edge) => {
        Object.assign(edge, p);
        if (p.style) edge.style = { ...edge.style, ...p.style };
      }
    );
    rememberEdgeAttrs({
      style: p.style,
      routing: p.routing,
      arrowStart: p.arrowStart,
      arrowEnd: p.arrowEnd,
    });
    commit();
  };

  const first = selectedNodes[0];
  const firstEdge = selectedEdges[0];

  return (
    <aside className="w-64 shrink-0 border-l border-border bg-panel flex flex-col text-sm">
      <div className="p-3 border-b border-border text-sm text-fg font-semibold uppercase tracking-wide">
        {selectedEdges.length > 0 ? 'Connector' : `${selectedNodes.length} shape${selectedNodes.length > 1 ? 's' : ''}`}
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-4">
        {selectedNodes.length > 0 ? (
          <>
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
                onChange={(v) => patch({ strokeWidth: v })}
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
                onChange={(v) => patch({ fontSize: v })}
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
            </Section>
            {selectedNodes.some((n) => n.type === 'rect') ? (
              <Section title="Corners">
                <SliderRow
                  label="Radius"
                  min={0}
                  max={48}
                  step={1}
                  value={first?.style.cornerRadius ?? 8}
                  onChange={(v) => patch({ cornerRadius: v })}
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
                  onChange={(e) => {
                    const deg = Number(e.target.value);
                    updateNodes(
                      selectedNodes.map((n) => n.id),
                      (n) => {
                        n.rotation = (deg * Math.PI) / 180;
                      }
                    );
                  }}
                  onMouseUp={commit}
                  className="flex-1 accent-sky-400"
                />
                <input
                  type="number"
                  min={0}
                  max={360}
                  value={Math.round(((first?.rotation ?? 0) * 180) / Math.PI) % 360}
                  onChange={(e) => {
                    const deg = Number(e.target.value);
                    updateNodes(
                      selectedNodes.map((n) => n.id),
                      (n) => {
                        n.rotation = (deg * Math.PI) / 180;
                      }
                    );
                    commit();
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
                  onChange={(v) => patch({ opacity: v / 100 })}
                />
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
                      updateNodes([first.id], (n) => {
                        n.width = n.content.naturalWidth!;
                        n.height = n.content.naturalHeight!;
                      });
                      commit();
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
                onChange={(e) => {
                  const v = e.target.value;
                  updateNodes(
                    selectedNodes.map((n) => n.id),
                    (n) => {
                      n.content = { ...n.content, link: v || undefined };
                    }
                  );
                }}
                onBlur={commit}
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
            <Section title="Arrowheads">
              <div className="grid grid-cols-2 gap-1">
                <ToggleBtn
                  active={firstEdge?.arrowStart ?? false}
                  onClick={() => patchEdges({ arrowStart: !firstEdge?.arrowStart })}
                  icon={ArrowBigLeft}
                  label="Start"
                />
                <ToggleBtn
                  active={firstEdge?.arrowEnd ?? false}
                  onClick={() => patchEdges({ arrowEnd: !firstEdge?.arrowEnd })}
                  icon={ArrowBigRight}
                  label="End"
                />
              </div>
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
                sliderMax={10}
                step={0.5}
                min={0.5}
                max={100}
                value={firstEdge?.style.strokeWidth ?? 2}
                onChange={(v) => patchEdges({ style: { strokeWidth: v } })}
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
                onChange={(e) => {
                  updateEdges(
                    selectedEdges.map((ed) => ed.id),
                    (edge) => {
                      edge.label = e.target.value;
                    }
                  );
                }}
                onBlur={commit}
                placeholder="optional"
                className="w-full bg-canvas rounded px-2 py-1 border border-border outline-none focus:border-accent"
              />
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
  return (
    <div className="flex gap-1 flex-wrap items-center">
      {options.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={`w-6 h-6 rounded ${value === c ? 'ring-2 ring-accent ring-offset-1 ring-offset-panel' : 'ring-1 ring-border'}`}
          style={{
            background:
              c === 'transparent' ? 'repeating-linear-gradient(45deg,#999 0 3px,#ddd 3px 6px)' : c,
          }}
          title={c === 'transparent' ? 'Transparent (no fill)' : c}
        />
      ))}
      <label
        className={`w-6 h-6 rounded overflow-hidden cursor-pointer relative ${
          custom ? 'ring-2 ring-accent ring-offset-1 ring-offset-panel' : 'ring-1 ring-border'
        }`}
        title={custom ? `Custom ${value}` : 'Custom colour…'}
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
function NumericSliderRow({
  label,
  sliderMin,
  sliderMax,
  step,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  sliderMin: number;
  sliderMax: number;
  step: number;
  min: number;
  max: number;
  value: number;
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
    if (clamped !== value) onChange(clamped);
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

function SizeRow({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <NumericSliderRow
      label="Size"
      sliderMin={8}
      sliderMax={72}
      step={1}
      min={4}
      max={999}
      value={value}
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
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
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

function ToggleBtn({
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
      className={`py-2 rounded flex items-center justify-center gap-1.5 text-xs ${
        active ? 'bg-accent text-white' : 'hover:bg-panel-hover text-fg-muted border border-border'
      }`}
    >
      <Icon size={14} /> {label}
    </button>
  );
}

function IconBtn({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<any>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="py-1.5 rounded border border-border hover:bg-panel-hover flex items-center justify-center text-fg-muted"
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

const BOARD_BG_PALETTE: Array<{ value: string; label: string }> = [
  { value: '#ffffff', label: 'White' },
  { value: '#f7f8fa', label: 'Pearl' },
  { value: '#f4f1ea', label: 'Paper' },
  { value: '#eef2f5', label: 'Mist' },
  { value: '#edf4ec', label: 'Sage' },
  { value: '#fdf5d3', label: 'Cream' },
  { value: '#1a1b1e', label: 'Graphite' },
  { value: 'transparent', label: 'Transparent' },
];

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
            {BOARD_BG_PALETTE.map((o) => (
              <button
                key={o.value}
                onClick={() => set(o.value)}
                title={o.label}
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
          </div>
          <div className="text-xs text-fg-muted pt-2 leading-relaxed">
            This colour is the board's paper and is included in Solid exports.
            Transparent exports always ignore it.
          </div>
        </div>
        {lockedNodes.length > 0 ? (
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wider text-fg font-semibold">
              Reference images
            </div>
            {lockedNodes.map((n) => (
              <div
                key={n.id}
                className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5"
              >
                <Lock size={12} className="text-fg-muted shrink-0" />
                <span className="flex-1 truncate text-xs text-fg" title={n.id}>
                  {n.type === 'image' ? 'Image' : n.type}{' '}
                  {Math.round(n.width)} × {Math.round(n.height)}
                </span>
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
