import { memo, useEffect, useRef } from 'react';
import type { CanvasNode } from '@shared/types';
import { icons as LucideIcons } from 'lucide-react';
import { useCanvas } from '@/store/canvasStore';
import { box3dDepth, colboxHeader, dsboxOffset, labelBox } from '@/util/geometry';

type Props = {
  node: CanvasNode;
  selected: boolean;
  onPointerDown: (e: React.PointerEvent, node: CanvasNode) => void;
  onDoubleClick: (node: CanvasNode) => void;
  editing: boolean;
  onFinishEdit: (text: string) => void;
  imageUrl?: string;
  /** Board-level dimming of locked reference nodes (canvas only; exporter restores base opacity). */
  dimmed?: boolean;
};

function ShapeInner({
  node,
  selected,
  onPointerDown,
  onDoubleClick,
  editing,
  onFinishEdit,
  imageUrl,
  dimmed,
}: Props) {
  const centerX = node.x + node.width / 2;
  const centerY = node.y + node.height / 2;
  const transform = node.rotation
    ? `rotate(${(node.rotation * 180) / Math.PI} ${centerX} ${centerY})`
    : undefined;

  const style = node.style;
  const fill = style.fill ?? '#1f2937';
  const stroke = style.stroke ?? '#e6e8eb';
  const strokeWidth = style.strokeWidth ?? 2;
  const baseOpacity = style.opacity ?? 1;
  const opacity = dimmed ? baseOpacity * 0.35 : baseOpacity;

  const commonPointer = (e: React.PointerEvent) => onPointerDown(e, node);

  let shape: React.ReactNode;
  if (node.type === 'rect') {
    shape = (
      <rect
        x={node.x}
        y={node.y}
        width={node.width}
        height={node.height}
        rx={style.cornerRadius ?? 8}
        ry={style.cornerRadius ?? 8}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={style.strokeDasharray}
        opacity={opacity}
      />
    );
  } else if (node.type === 'diamond') {
    const pts = `${centerX} ${node.y}, ${node.x + node.width} ${centerY}, ${centerX} ${node.y + node.height}, ${node.x} ${centerY}`;
    shape = (
      <polygon
        points={pts}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={style.strokeDasharray}
        opacity={opacity}
      />
    );
  } else if (node.type === 'box3d') {
    // Front face inset by d; top and left bands in the stroke colour at half opacity.
    const d = box3dDepth(node);
    const { x, y, width: w, height: h } = node;
    const band = { fill: stroke, fillOpacity: 0.5, stroke, strokeWidth, strokeDasharray: style.strokeDasharray, strokeLinejoin: 'round' as const };
    shape = (
      <g opacity={opacity}>
        <polygon points={`${x} ${y}, ${x + w - d} ${y}, ${x + w} ${y + d}, ${x + d} ${y + d}`} {...band} />
        <polygon points={`${x} ${y}, ${x + d} ${y + d}, ${x + d} ${y + h}, ${x} ${y + h - d}`} {...band} />
        <rect x={x + d} y={y + d} width={w - d} height={h - d} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={style.strokeDasharray} />
      </g>
    );
  } else if (node.type === 'dsbox') {
    // Data store: a wide box with one vertical line near the left edge.
    const o = dsboxOffset(node);
    shape = (
      <g opacity={opacity}>
        <rect x={node.x} y={node.y} width={node.width} height={node.height} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={style.strokeDasharray} />
        <line x1={node.x + o} y1={node.y} x2={node.x + o} y2={node.y + node.height} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={style.strokeDasharray} />
      </g>
    );
  } else if (node.type === 'colbox') {
    // Collection: a box with one horizontal divider near the top; text goes below it.
    const hh = colboxHeader(node);
    shape = (
      <g opacity={opacity}>
        <rect x={node.x} y={node.y} width={node.width} height={node.height} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={style.strokeDasharray} />
        <line x1={node.x} y1={node.y + hh} x2={node.x + node.width} y2={node.y + hh} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={style.strokeDasharray} />
      </g>
    );
  } else if (node.type === 'ellipse') {
    shape = (
      <ellipse
        cx={centerX}
        cy={centerY}
        rx={node.width / 2}
        ry={node.height / 2}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={style.strokeDasharray}
        opacity={opacity}
      />
    );
  } else if (node.type === 'image' && imageUrl) {
    shape = (
      <image
        href={imageUrl}
        x={node.x}
        y={node.y}
        width={node.width}
        height={node.height}
        opacity={opacity}
        preserveAspectRatio="xMidYMid meet"
      />
    );
  } else if (node.type === 'icon') {
    const iconName = node.content.iconName ?? 'Square';
    const IconComp = (LucideIcons as Record<string, React.ComponentType<any>>)[iconName];
    shape = (
      <foreignObject
        data-fo-role="icon"
        x={node.x}
        y={node.y}
        width={node.width}
        height={node.height}
      >
        {IconComp ? (
          <IconComp
            width={node.width}
            height={node.height}
            color={style.color ?? '#e6e8eb'}
            strokeWidth={strokeWidth}
            opacity={opacity}
          />
        ) : null}
      </foreignObject>
    );
  }

  const hasLabel =
    node.type === 'text' ||
    node.type === 'rect' ||
    node.type === 'ellipse' ||
    node.type === 'diamond' ||
    node.type === 'box3d' ||
    node.type === 'dsbox' ||
    node.type === 'colbox';
  const labelShouldRotate = node.type === 'text';
  const label = node.content.text ?? '';
  const lb = labelBox(node);

  const labelElement = hasLabel ? (
    <foreignObject
      data-fo-role="label"
      x={lb.x}
      y={lb.y}
      width={lb.width}
      height={lb.height}
      pointerEvents={node.type === 'text' ? 'all' : 'none'}
    >
      <div
        className="w-full h-full flex justify-center p-2"
        style={{
          color: style.color ?? '#e6e8eb',
          fontFamily: style.fontFamily ?? 'Inter, system-ui, sans-serif',
          fontSize: `${style.fontSize ?? 16}px`,
          fontWeight: style.fontWeight ?? 500,
          textAlign: style.textAlign ?? 'center',
          alignItems:
            style.verticalAlign === 'top'
              ? 'flex-start'
              : style.verticalAlign === 'bottom'
                ? 'flex-end'
                : 'center',
          overflow: 'hidden',
          wordBreak: 'break-word',
          lineHeight: 1.3,
          whiteSpace: 'pre-wrap',
        }}
      >
        {editing ? (
          <EditableText initial={label} onCommit={onFinishEdit} />
        ) : (
          label || (node.type === 'text' ? <span className="opacity-40">Text</span> : null)
        )}
      </div>
    </foreignObject>
  ) : null;

  return (
    <g
      data-node-id={node.id}
      data-node-type={node.type}
      data-base-opacity={dimmed ? baseOpacity : undefined}
      onPointerDown={commonPointer}
      onDoubleClick={() => onDoubleClick(node)}
      style={{ cursor: node.locked ? 'default' : 'move' }}
    >
      <g transform={transform}>
        {shape}
        {labelShouldRotate ? labelElement : null}
        {selected ? (
          <rect
            x={node.x - 0.5}
            y={node.y - 0.5}
            width={node.width + 1}
            height={node.height + 1}
            rx={(node.style.cornerRadius ?? 8) + 0.5}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={1.5 / useCanvas.getState().viewport.zoom}
            pointerEvents="none"
          />
        ) : null}
      </g>
      {!labelShouldRotate && hasLabel ? labelElement : null}
    </g>
  );
}

function EditableText({ initial, onCommit }: { initial: string; onCommit: (t: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const valRef = useRef<string>(initial);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerText = initial;
    const grab = () => {
      el.focus({ preventScroll: true });
      if (document.activeElement !== el) return;
      try {
        const range = document.createRange();
        range.selectNodeContents(el);
        if (initial.length > 0) range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      } catch {
        // empty content can refuse selection; ignore
      }
    };
    const t = setTimeout(grab, 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={(e) => {
        valRef.current = (e.target as HTMLElement).innerText;
      }}
      onBlur={() => onCommit(valRef.current)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onCommit(initial);
        } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          onCommit(valRef.current);
        }
        e.stopPropagation();
      }}
      style={{ outline: 'none', width: '100%', height: '100%' }}
    />
  );
}

export default memo(ShapeInner);
