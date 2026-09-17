import { memo } from 'react';
import type { CanvasEdge, CanvasNode } from '@shared/types';
import { buildPath, edgeEndpoints } from './routing';
import { headMarker } from './edgeHeads';
import { edgeLabelBox } from '@/util/geometry';

type Props = {
  edge: CanvasEdge;
  nodes: Record<string, CanvasNode>;
  /** Board paper colour: sets the label's default text colour and pill background. */
  paper: string;
  selected: boolean;
  onPointerDown?: (e: React.PointerEvent, edge: CanvasEdge) => void;
  onLabelPointerDown?: (e: React.PointerEvent, edge: CanvasEdge) => void;
};

function EdgeInner({ edge, nodes, paper, selected, onPointerDown, onLabelPointerDown }: Props) {
  const d = buildPath(edge, nodes);
  const lb = edgeLabelBox(edge, paper);
  const stroke = edge.style.stroke ?? '#e6e8eb';
  const strokeWidth = edge.style.strokeWidth ?? 2;
  const opacity = edge.style.opacity ?? 1;
  const dasharray = edge.style.strokeDasharray;
  const { from, to } = edgeEndpoints(edge, nodes);
  const defaultMid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const labelAt = edge.labelPoint ?? defaultMid;

  return (
    <g>
      {/* Wide invisible hit path */}
      <path
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(16, strokeWidth + 12)}
        onPointerDown={(e) => onPointerDown?.(e, edge)}
        style={{ cursor: 'pointer' }}
      />
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={dasharray}
        opacity={opacity}
        markerStart={edge.headStart !== 'none' ? `url(#head-start-${edge.id})` : undefined}
        markerEnd={edge.headEnd !== 'none' ? `url(#head-end-${edge.id})` : undefined}
        pointerEvents="none"
      />
      {selected ? (
        <path
          d={d}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={strokeWidth + 4}
          opacity={0.25}
          pointerEvents="none"
        />
      ) : null}
      {edge.label ? (
        <foreignObject
          data-fo-role="edge-label"
          data-edge-id={edge.id}
          x={labelAt.x - lb.w / 2}
          y={labelAt.y - lb.h / 2}
          width={lb.w}
          height={lb.h}
          pointerEvents={selected ? 'all' : 'none'}
          style={{ cursor: selected ? 'move' : 'default' }}
          onPointerDown={(e) => {
            if (selected) onLabelPointerDown?.(e, edge);
          }}
        >
          <div className="w-full h-full flex items-center justify-center">
            <div
              className="text-center rounded px-1.5 py-0.5 inline-block whitespace-nowrap"
              style={{
                color: lb.color,
                fontSize: `${lb.fontSize}px`,
                fontFamily: lb.fontFamily,
                fontWeight: lb.fontWeight,
                lineHeight: 1.3,
                background: lb.bg,
                border: `1px solid ${stroke}`,
              }}
            >
              {edge.label}
            </div>
          </div>
        </foreignObject>
      ) : null}

      {edge.headStart !== 'none' || edge.headEnd !== 'none' ? (
        <defs>
          {headMarker(edge.headStart, `head-start-${edge.id}`, stroke)}
          {headMarker(edge.headEnd, `head-end-${edge.id}`, stroke)}
        </defs>
      ) : null}
    </g>
  );
}

export default memo(EdgeInner);
