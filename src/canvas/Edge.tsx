import { memo } from 'react';
import type { CanvasEdge, CanvasNode } from '@shared/types';
import { buildPath, edgeEndpoints } from './routing';
import { headMarker } from './edgeHeads';

type Props = {
  edge: CanvasEdge;
  nodes: Record<string, CanvasNode>;
  selected: boolean;
  onPointerDown?: (e: React.PointerEvent, edge: CanvasEdge) => void;
  onLabelPointerDown?: (e: React.PointerEvent, edge: CanvasEdge) => void;
};

function EdgeInner({ edge, nodes, selected, onPointerDown, onLabelPointerDown }: Props) {
  const d = buildPath(edge, nodes);
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
          x={labelAt.x - 60}
          y={labelAt.y - 12}
          width={120}
          height={24}
          pointerEvents={selected ? 'all' : 'none'}
          style={{ cursor: selected ? 'move' : 'default' }}
          onPointerDown={(e) => {
            if (selected) onLabelPointerDown?.(e, edge);
          }}
        >
          <div
            className="text-xs text-center px-1.5 py-0.5 rounded bg-panel/80 border border-border inline-block"
            style={{ color: edge.style.color ?? '#e6e8eb' }}
          >
            {edge.label}
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
