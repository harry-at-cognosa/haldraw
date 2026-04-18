import { useCanvas } from '@/store/canvasStore';
import type { Anchor, CanvasEdge, CanvasNode, EdgeRouting, NodeStyle } from '@shared/types';
import { useRef } from 'react';
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
} from 'lucide-react';

const PALETTE = [
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
              <SliderRow
                label="Width"
                min={0}
                max={12}
                step={0.5}
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
              <SliderRow
                label="Size"
                min={8}
                max={72}
                step={1}
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
              <SliderRow
                label="Width"
                min={0.5}
                max={10}
                step={0.5}
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
  return (
    <div className="flex gap-1 flex-wrap">
      {options.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={`w-6 h-6 rounded ${value === c ? 'ring-2 ring-accent ring-offset-1 ring-offset-panel' : 'ring-1 ring-border'}`}
          style={{
            background: c === 'transparent' ? 'repeating-linear-gradient(45deg,#444 0 3px,#222 3px 6px)' : c,
          }}
          title={c}
        />
      ))}
    </div>
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
      </div>
    </aside>
  );
}
